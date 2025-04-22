import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';

// Define types
interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  isCompleted: boolean;
  addedAt: string;
}

interface GroceryList {
  id: string;
  name: string;
  description: string;
  items: GroceryItem[];
  createdAt: string;
  updatedAt: string;
}

export default function Index() {
  // State variables
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState<GroceryList | null>(null);
  const [newList, setNewList] = useState({
    name: '',
    description: ''
  });
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '1',
    category: ''
  });
  const [editItem, setEditItem] = useState<GroceryItem | null>(null);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthenticated(true);
      } else {
        setUserId(null);
        setIsAuthenticated(false);
        // Redirect to login if not authenticated
        router.replace('./login');
      }
    });

    return () => unsubscribe();
  }, []);

  // Load lists from Firestore when user is authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadListsFromFirestore();
    }
  }, [isAuthenticated, userId]);

  // Load lists from Firestore
  const loadListsFromFirestore = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      const userListsRef = collection(db, 'users', userId, 'groceryLists');
      const querySnapshot = await getDocs(userListsRef);
      
      const loadedLists: GroceryList[] = [];
      
      querySnapshot.forEach((doc) => {
        const listData = doc.data();
        loadedLists.push({
          id: doc.id,
          name: listData.name,
          description: listData.description || '',
          items: listData.items || [],
          createdAt: listData.createdAt,
          updatedAt: listData.updatedAt
        });
      });
      
      setLists(loadedLists);
    } catch (error) {
      console.error('Failed to load grocery lists:', error);
      Alert.alert('Error', 'Failed to load your grocery lists');
    } finally {
      setLoading(false);
    }
  };

  // Create a new grocery list in Firestore
  const createList = async () => {
    if (!userId) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    
    if (!newList.name.trim()) {
      Alert.alert('Error', 'List name is required');
      return;
    }

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      
      const listData = {
        name: newList.name,
        description: newList.description,
        items: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        userId: userId
      };
      
      const userListsRef = collection(db, 'users', userId, 'groceryLists');
      const docRef = await addDoc(userListsRef, listData);
      
      const newListData: GroceryList = {
        id: docRef.id,
        name: newList.name,
        description: newList.description,
        items: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      setLists([...lists, newListData]);
      setNewList({ name: '', description: '' });
      setCreateListModalVisible(false);
    } catch (error) {
      console.error('Failed to create grocery list:', error);
      Alert.alert('Error', 'Failed to create grocery list');
    } finally {
      setLoading(false);
    }
  };

  // Add item to selected list
  const addItemToList = async () => {
    if (!userId || !selectedList) return;
    
    if (!newItem.name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      
      const newItemData: GroceryItem = {
        id: `item-${Date.now()}`,
        name: newItem.name,
        quantity: newItem.quantity || '1',
        category: newItem.category || 'Uncategorized',
        isCompleted: false,
        addedAt: timestamp
      };

      const updatedItems = [...selectedList.items, newItemData];
      
      // Update in Firestore
      const listRef = doc(db, 'users', userId, 'groceryLists', selectedList.id);
      await updateDoc(listRef, {
        items: updatedItems,
        updatedAt: timestamp
      });

      // Update local state
      const updatedLists = lists.map(list => {
        if (list.id === selectedList.id) {
          return {
            ...list,
            items: updatedItems,
            updatedAt: timestamp
          };
        }
        return list;
      });

      setLists(updatedLists);
      setNewItem({ name: '', quantity: '1', category: '' });
      setSelectedList(updatedLists.find(list => list.id === selectedList.id) || null);
    } catch (error) {
      console.error('Failed to add item to list:', error);
      Alert.alert('Error', 'Failed to add item to list');
    } finally {
      setLoading(false);
    }
  };

  // Update an existing item
  const updateItem = async () => {
    if (!userId || !selectedList || !editItem) return;

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      
      const updatedItems = selectedList.items.map(item => 
        item.id === editItem.id ? editItem : item
      );
      
      // Update in Firestore
      const listRef = doc(db, 'users', userId, 'groceryLists', selectedList.id);
      await updateDoc(listRef, {
        items: updatedItems,
        updatedAt: timestamp
      });

      // Update local state
      const updatedLists = lists.map(list => {
        if (list.id === selectedList.id) {
          return {
            ...list,
            items: updatedItems,
            updatedAt: timestamp
          };
        }
        return list;
      });

      setLists(updatedLists);
      setEditItem(null);
      setEditItemModalVisible(false);
      setSelectedList(updatedLists.find(list => list.id === selectedList.id) || null);
    } catch (error) {
      console.error('Failed to update item:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  // Toggle item completion status
  const toggleItemCompletion = async (itemId: string) => {
    if (!userId || !selectedList) return;

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      
      const updatedItems = selectedList.items.map(item => 
        item.id === itemId ? {...item, isCompleted: !item.isCompleted} : item
      );
      
      // Update in Firestore
      const listRef = doc(db, 'users', userId, 'groceryLists', selectedList.id);
      await updateDoc(listRef, {
        items: updatedItems,
        updatedAt: timestamp
      });

      // Update local state
      const updatedLists = lists.map(list => {
        if (list.id === selectedList.id) {
          return {
            ...list,
            items: updatedItems,
            updatedAt: timestamp
          };
        }
        return list;
      });

      setLists(updatedLists);
      setSelectedList(updatedLists.find(list => list.id === selectedList.id) || null);
    } catch (error) {
      console.error('Failed to update item completion status:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  // Remove item from list
  const removeItem = async (itemId: string) => {
    if (!userId || !selectedList) return;

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      
      const updatedItems = selectedList.items.filter(item => item.id !== itemId);
      
      // Update in Firestore
      const listRef = doc(db, 'users', userId, 'groceryLists', selectedList.id);
      await updateDoc(listRef, {
        items: updatedItems,
        updatedAt: timestamp
      });

      // Update local state
      const updatedLists = lists.map(list => {
        if (list.id === selectedList.id) {
          return {
            ...list,
            items: updatedItems,
            updatedAt: timestamp
          };
        }
        return list;
      });

      setLists(updatedLists);
      setSelectedList(updatedLists.find(list => list.id === selectedList.id) || null);
    } catch (error) {
      console.error('Failed to remove item:', error);
      Alert.alert('Error', 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  };

  // Delete list
  const deleteList = async (listId: string) => {
    if (!userId) return;
    
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this grocery list? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete from Firestore
              const listRef = doc(db, 'users', userId, 'groceryLists', listId);
              await deleteDoc(listRef);

              // Update local state
              const updatedLists = lists.filter(list => list.id !== listId);
              setLists(updatedLists);
              setModalVisible(false);
              setSelectedList(null);
            } catch (error) {
              console.error('Failed to delete list:', error);
              Alert.alert('Error', 'Failed to delete list');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Share list (placeholder - in a real app this would generate a shareable link or code)
  const shareList = (listId: string) => {
    Alert.alert('Share List', 'Sharing functionality would be implemented soon.');
  };

  // Render list item for FlatList
  const renderListItem = ({ item }: { item: GroceryList }) => {
    const completedItems = item.items.filter(item => item.isCompleted).length;
    const totalItems = item.items.length;
    
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          setSelectedList(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.listItemContent}>
          <Text style={styles.listName}>{item.name}</Text>
          <Text style={styles.listDescription} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.itemCount}>
            {totalItems} {totalItems === 1 ? 'item' : 'items'} 
            {totalItems > 0 ? ` • ${completedItems}/${totalItems} completed` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#aaa" />
      </TouchableOpacity>
    );
  };

  // Render a grocery item
  const renderGroceryItem = (item: GroceryItem) => {
    return (
      <View key={item.id} style={styles.groceryItem}>
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => toggleItemCompletion(item.id)}
        >
          <View style={[
            styles.checkbox, 
            item.isCompleted ? styles.checkboxChecked : {}
          ]}>
            {item.isCompleted && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.itemDetails}>
          <Text style={[
            styles.itemName, 
            item.isCompleted ? styles.itemCompleted : {}
          ]}>
            {item.name}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
            <Text style={styles.itemCategory}>{item.category}</Text>
          </View>
        </View>
        
        <View style={styles.itemActions}>
          <TouchableOpacity 
            style={styles.itemAction}
            onPress={() => {
              setEditItem(item);
              setEditItemModalVisible(true);
            }}
          >
            <Ionicons name="pencil" size={20} color="#60a5fa" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.itemAction}
            onPress={() => removeItem(item.id)}
          >
            <Ionicons name="trash" size={20} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // List details modal
  const renderListDetailsModal = () => {
    if (!selectedList) return null;

    // Group items by category
    const groupedItems: {[key: string]: GroceryItem[]} = {};
    selectedList.items.forEach(item => {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    });

    const categories = Object.keys(groupedItems).sort();

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedList(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setSelectedList(null);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedList.name}</Text>
            <TouchableOpacity onPress={() => shareList(selectedList.id)}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedList.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>
                  {selectedList.description}
                </Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items</Text>
              {selectedList.items.length === 0 ? (
                <View style={styles.emptyItems}>
                  <Ionicons name="basket-outline" size={48} color="#60a5fa" />
                  <Text style={styles.emptyItemsText}>No items in this list</Text>
                </View>
              ) : (
                categories.map(category => (
                  <View key={category} style={styles.categorySection}>
                    <Text style={styles.categoryTitle}>{category}</Text>
                    {groupedItems[category].map(item => renderGroceryItem(item))}
                  </View>
                ))
              )}
            </View>

            <View style={styles.addItemSection}>
              <Text style={styles.addItemTitle}>Add New Item</Text>
              <TextInput
                style={styles.input}
                placeholder="Item name"
                placeholderTextColor="#888"
                value={newItem.name}
                onChangeText={text => setNewItem({ ...newItem, name: text })}
              />
              <View style={styles.itemFormRow}>
                <TextInput
                  style={[styles.input, styles.quantityInput]}
                  placeholder="Quantity"
                  placeholderTextColor="#888"
                  value={newItem.quantity}
                  onChangeText={text => setNewItem({ ...newItem, quantity: text })}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.categoryInput]}
                  placeholder="Category"
                  placeholderTextColor="#888"
                  value={newItem.category}
                  onChangeText={text => setNewItem({ ...newItem, category: text })}
                />
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addItemToList}
              >
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteList(selectedList.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Delete List</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Edit item modal
  const renderEditItemModal = () => {
    if (!editItem) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={editItemModalVisible}
        onRequestClose={() => {
          setEditItemModalVisible(false);
          setEditItem(null);
        }}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Item</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Item name"
              placeholderTextColor="#888"
              value={editItem.name}
              onChangeText={text => setEditItem({ ...editItem, name: text })}
            />
            
            <View style={styles.itemFormRow}>
              <TextInput
                style={[styles.input, styles.quantityInput]}
                placeholder="Quantity"
                placeholderTextColor="#888"
                value={editItem.quantity}
                onChangeText={text => setEditItem({ ...editItem, quantity: text })}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.categoryInput]}
                placeholder="Category"
                placeholderTextColor="#888"
                value={editItem.category}
                onChangeText={text => setEditItem({ ...editItem, category: text })}
              />
            </View>
            
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditItemModalVisible(false);
                  setEditItem(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={updateItem}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Create list modal
  const renderCreateListModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={createListModalVisible}
        onRequestClose={() => {
          setCreateListModalVisible(false);
          setNewList({ name: '', description: '' });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setCreateListModalVisible(false);
                setNewList({ name: '', description: '' });
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New Grocery List</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>List Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter list name"
              placeholderTextColor="#888"
              value={newList.name}
              onChangeText={text => setNewList({ ...newList, name: text })}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter list description (optional)"
              placeholderTextColor="#888"
              value={newList.description}
              onChangeText={text => setNewList({ ...newList, description: text })}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.createButton}
              onPress={createList}
            >
              <Text style={styles.createButtonText}>Create List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      // Router will automatically redirect to login due to auth state change
    } catch (error) {
      console.error('Failed to sign out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  // Main render
  return (
    <View style={styles.container}>
      {loading && !lists.length ? (
        <ActivityIndicator size="large" color="#60a5fa" style={styles.loader} />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Grocery Lists</Text>
            <View style={styles.headerButtons}>
              {/* <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color="#f87171" />
              </TouchableOpacity> */}
              <TouchableOpacity
                style={styles.addListButton}
                onPress={() => setCreateListModalVisible(true)}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {lists.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={64} color="#60a5fa" />
              <Text style={styles.emptyStateText}>
                You don't have any grocery lists yet
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Create a list to start organizing your shopping
              </Text>
              <TouchableOpacity
                style={styles.createFirstListButton}
                onPress={() => setCreateListModalVisible(true)}
              >
                <Text style={styles.createFirstListButtonText}>
                  Create Your First List
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={lists}
              renderItem={renderListItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              refreshing={loading}
              onRefresh={loadListsFromFirestore}
            />
          )}

          {renderListDetailsModal()}
          {renderCreateListModal()}
          {renderEditItemModal()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    padding: 8,
    marginRight: 8,
  },
  addListButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333940',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  listDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 12,
    color: '#60a5fa',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#60a5fa',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  itemCompleted: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  itemMeta: {
    flexDirection: 'row',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#aaa',
    marginRight: 8,
  },
  itemCategory: {
    fontSize: 14,
    color: '#60a5fa',
  },
  itemActions: {
    flexDirection: 'row',
  },
  itemAction: {
    padding: 8,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60a5fa',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  addItemSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#333940',
    borderRadius: 12,
  },
  addItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  itemFormRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quantityInput: {
    flex: 1,
    marginRight: 8,
  },
  categoryInput: {
    flex: 2,
  },
  input: {
    backgroundColor: '#3a3f44',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  loader: {
    marginVertical: 20,
  },
    addButton: {
      backgroundColor: '#60a5fa',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    addButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f87171',
      borderRadius: 8,
      padding: 12,
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      marginLeft: 8,
    },
    inputLabel: {
      fontSize: 16,
      color: '#ccc',
      marginBottom: 8,
    },
    createButton: {
      backgroundColor: '#60a5fa',
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    createButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: '#aaa',
      textAlign: 'center',
      marginBottom: 24,
    },
    createFirstListButton: {
      backgroundColor: '#60a5fa',
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      width: '100%',
    },
    createFirstListButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    emptyItems: {
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyItemsText: {
      fontSize: 16,
      color: '#aaa',
      marginTop: 8,
    },
    editModalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    editModalContent: {
      width: '90%',
      backgroundColor: '#333940',
      borderRadius: 12,
      padding: 20,
    },
    editModalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 16,
      textAlign: 'center',
    },
    editModalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: '#525760',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginRight: 8,
    },
    cancelButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    saveButton: {
      flex: 1,
      backgroundColor: '#60a5fa',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginLeft: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
  });