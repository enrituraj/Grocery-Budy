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
import * as Contacts from 'expo-contacts';
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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import Chat from './../chat';
// Define types
interface Member {
  userId: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  joinedAt: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function GroupScreen() {
  // State variables
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'chat'
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Current user from Firebase auth
  const user = auth.currentUser;
  const currentUser = {
    id: user?.uid || '',
    name: user?.displayName || 'User',
    email: user?.email || '',
    phone: user?.phoneNumber || ''
  };

  // Load groups from Firestore on component mount
  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  // Fetch user's contacts
  const getContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
        });

        if (data.length > 0) {
          const formattedContacts: Contact[] = data
            .filter(contact => contact.name && (contact.emails?.length || contact.phoneNumbers?.length))
            .map(contact => ({
              id: contact?.id || '', // Default to an empty string if undefined
              name: contact?.name,
              email: contact?.emails && contact?.emails.length > 0 ? contact?.emails[0].email || '' : '', // Default to an empty string
              phone: contact?.phoneNumbers && contact.phoneNumbers.length > 0 ? contact.phoneNumbers[0].number || '' : '' // Default to an empty string
            }));
          setContacts(formattedContacts);
        }
      } else {
        Alert.alert('Permission denied to access contacts');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to fetch contacts');
    }
  };

  // Load groups from Firestore
  const loadGroups = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);

      // First, get groups where current user is a member
      const groupsCollectionRef = collection(db, 'groups');
      const q = query(
        groupsCollectionRef,
        where('memberEmails', 'array-contains', user.email)
      );

      const querySnapshot = await getDocs(q);
      const loadedGroups: Group[] = [];

      querySnapshot.forEach((doc) => {
        const groupData = doc.data();
        loadedGroups.push({
          id: doc.id,
          name: groupData.name,
          description: groupData.description,
          members: groupData.members || [],
          createdBy: groupData.createdBy,
          createdAt: groupData.createdAt ? new Date(groupData.createdAt.toDate()).toISOString() : new Date().toISOString(),
          updatedAt: groupData.updatedAt ? new Date(groupData.updatedAt.toDate()).toISOString() : new Date().toISOString()
        });
      });

      setGroups(loadedGroups);
    } catch (error) {
      console.error('Failed to load groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  // Save group to Firestore
  const saveGroup = async (groupData: Group) => {
    try {
      const memberEmails = groupData.members.map(member => member.email);

      const groupRef = doc(db, 'groups', groupData.id);
      await setDoc(groupRef, {
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        memberEmails: memberEmails, // Array of member emails for querying
        createdBy: groupData.createdBy,
        createdAt: Timestamp.fromDate(new Date(groupData.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(groupData.updatedAt))
      });

      return true;
    } catch (error) {
      console.error('Failed to save group:', error);
      Alert.alert('Error', 'Failed to save group');
      return false;
    }
  };

  // Create a new group
  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a group');
      return;
    }

    const timestamp = new Date().toISOString();
    const newGroupData: Group = {
      id: `group-${Date.now()}`,
      name: newGroup.name,
      description: newGroup.description,
      members: [
        {
          userId: currentUser.id,
          name: currentUser.name || user.email?.split('@')[0] || 'User',
          email: currentUser.email || user.email || '',
          phone: currentUser.phone || '',
          isAdmin: true,
          joinedAt: timestamp
        }
      ],
      createdBy: currentUser.id,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const success = await saveGroup(newGroupData);
    if (success) {
      setGroups([...groups, newGroupData]);
      setNewGroup({ name: '', description: '' });
      setCreateGroupModalVisible(false);
    }
  };

  // Add member to selected group
  const addMemberToGroup = async () => {
    if (!selectedGroup) return;
    if (!newMember.name.trim() || !newMember.email.trim()) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }

    // Check if member with this email already exists
    const memberExists = selectedGroup.members.some(
      member => member.email.toLowerCase() === newMember.email.toLowerCase()
    );

    if (memberExists) {
      Alert.alert('Error', 'A member with this email already exists in the group');
      return;
    }

    const timestamp = new Date().toISOString();
    const newMemberData: Member = {
      userId: `temp-user-${Date.now()}`, // Temporary ID for non-app users
      name: newMember.name,
      email: newMember.email.toLowerCase(),
      phone: newMember.phone,
      isAdmin: false,
      joinedAt: timestamp
    };

    const updatedGroup = {
      ...selectedGroup,
      members: [...selectedGroup.members, newMemberData],
      updatedAt: timestamp
    };

    const success = await saveGroup(updatedGroup);
    if (success) {
      const updatedGroups = groups.map(group =>
        group.id === selectedGroup.id ? updatedGroup : group
      );

      setGroups(updatedGroups);
      setSelectedGroup(updatedGroup);
      setNewMember({ name: '', email: '', phone: '' });
    }
  };

  // Add contact as member
  const addContactAsMember = async (contact: Contact) => {
    if (!selectedGroup) return;

    setNewMember({
      name: contact.name || '',
      email: contact.email || 'n/a',
      phone: contact.phone || ''
    });

    // If the email already exists in the group, show a warning
    if (contact.email) {
      const memberExists = selectedGroup.members.some(
        member => member.email.toLowerCase() === contact.email.toLowerCase()
      );

      if (memberExists) {
        Alert.alert('Warning', 'This contact is already a member of the group');
      }
    }



    const timestamp = new Date().toISOString();
    const newMemberData: Member = {
      userId: `temp-user-${Date.now()}`,
      name: contact.name,
      email: contact.email.toLowerCase() || 'n/a',
      phone: contact.phone || '',
      isAdmin: false,
      joinedAt: timestamp
    };

    const updatedGroup = {
      ...selectedGroup,
      members: [...selectedGroup.members, newMemberData],
      updatedAt: timestamp
    };

    const success = await saveGroup(updatedGroup);
    if (success) {
      const updatedGroups = groups.map(group =>
        group.id === selectedGroup.id ? updatedGroup : group
      );

      setGroups(updatedGroups);
      setSelectedGroup(updatedGroup);

      setNewMember({
        name: '',
        email:'',
        phone: ''
      });
      setContactsModalVisible(false);
    }
  };

  // Toggle admin status
  const toggleAdminStatus = async (member: Member) => {
    if (!selectedGroup) return;

    // Don't allow removing admin status if this is the only admin
    if (member.isAdmin && selectedGroup.members.filter(m => m.isAdmin).length === 1) {
      Alert.alert('Error', 'Cannot remove admin status - group must have at least one admin');
      return;
    }

    const updatedMembers = selectedGroup.members.map(m => {
      if (m.email === member.email) {
        return { ...m, isAdmin: !m.isAdmin };
      }
      return m;
    });

    const updatedGroup = {
      ...selectedGroup,
      members: updatedMembers,
      updatedAt: new Date().toISOString()
    };

    const success = await saveGroup(updatedGroup);
    if (success) {
      const updatedGroups = groups.map(group =>
        group.id === selectedGroup.id ? updatedGroup : group
      );

      setGroups(updatedGroups);
      setSelectedGroup(updatedGroup);
      setAdminModalVisible(false);
      setSelectedMember(null);
    }
  };

  // Remove member from group
  const removeMember = async (groupId: string, userEmail: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const member = group.members.find(m => m.email === userEmail);
    if (!member) return;

    if (member.email === currentUser.email) {
      Alert.alert(
        'Cannot Remove Yourself',
        'You cannot remove yourself from the group. Use "Leave Group" instead.'
      );
      return;
    }

    // Don't allow removing the last admin
    if (member.isAdmin && group.members.filter(m => m.isAdmin).length === 1) {
      Alert.alert('Error', 'Cannot remove the only admin of the group');
      return;
    }

    const timestamp = new Date().toISOString();
    const updatedGroup = {
      ...group,
      members: group.members.filter(m => m.email !== userEmail),
      updatedAt: timestamp
    };

    const success = await saveGroup(updatedGroup);
    if (success) {
      const updatedGroups = groups.map(g =>
        g.id === groupId ? updatedGroup : g
      );

      setGroups(updatedGroups);
      setSelectedGroup(updatedGroup);
    }
  };

  // Leave group
  const leaveGroup = async (groupId: string) => {
    if (!user?.email) return;

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const group = groups.find(g => g.id === groupId);
            if (!group) return;

            const timestamp = new Date().toISOString();

            // Check if current user is an admin
            const currentMember = group.members.find(m => m.email === user.email);
            const isAdmin = currentMember?.isAdmin || false;

            // Check if current user is the only admin
            const isOnlyAdmin = isAdmin &&
              group.members.filter(m => m.isAdmin).length === 1;

            if (isOnlyAdmin && group.members.length > 1) {
              // Make another member an admin
              const newAdminIndex = group.members.findIndex(m => m.email !== user.email);
              if (newAdminIndex !== -1) {
                const updatedMembers = [...group.members];
                updatedMembers[newAdminIndex] = {
                  ...updatedMembers[newAdminIndex],
                  isAdmin: true
                };

                const membersWithoutUser = updatedMembers.filter(m => m.email !== user.email);

                const updatedGroup = {
                  ...group,
                  members: membersWithoutUser,
                  updatedAt: timestamp
                };

                await saveGroup(updatedGroup);
              }
            } else if (group.members.length === 1) {
              // If user is the only member, delete the group
              await deleteDoc(doc(db, 'groups', groupId));
            } else {
              // Otherwise just remove the current user
              const updatedGroup = {
                ...group,
                members: group.members.filter(m => m.email !== user.email),
                updatedAt: timestamp
              };

              await saveGroup(updatedGroup);
            }

            const updatedGroups = groups.filter(g =>
              g.id !== groupId ||
              (g.id === groupId && g.members.length > 1 && !g.members.some(m => m.email === user.email))
            );

            setGroups(updatedGroups);
            setModalVisible(false);
            setSelectedGroup(null);
          }
        }
      ]
    );
  };

  // Delete group
  const deleteGroup = async (groupId: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'groups', groupId));

              const updatedGroups = groups.filter(group => group.id !== groupId);
              setGroups(updatedGroups);
              setModalVisible(false);
              setSelectedGroup(null);
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  // Navigate to expenses screen
  const navigateToExpenses = (groupId: string) => {
    setModalVisible(false);

    router.push(`/expenses/${groupId}`);
  };

  // Render group item for FlatList
  const renderGroupItem = ({ item }: { item: Group }) => {
    return (
      <TouchableOpacity
        style={styles.groupItem}
        onPress={() => {
          setSelectedGroup(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.groupItemContent}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.memberCount}>
            {item.members?.length || 0} {item.members?.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#aaa" />
      </TouchableOpacity>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Group details modal
  const renderGroupDetailsModal = () => {
    if (!selectedGroup) return null;

    const members = selectedGroup.members || [];
    const currentMember = members.find(member => member.email === user?.email);
    const isAdmin = currentMember?.isAdmin || false;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedGroup(null);
        }}
      >

        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setSelectedGroup(null);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
            <View style={{ width: 24 }} />
          </View>


          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'details' ? styles.activeTab : {}]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabText, activeTab === 'details' ? styles.activeTabText : {}]}>
                Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' ? styles.activeTab : {}]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabText, activeTab === 'chat' ? styles.activeTabText : {}]}>
                Chat
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'details' ? (
            <ScrollView>

              <View style={styles.modalContainer}>


                <ScrollView style={styles.modalBody}>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>
                      {selectedGroup.description || 'No description'}
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    {members.map(member => (
                      <View key={member.email} style={styles.memberItem}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => {
                            if (isAdmin) {
                              setSelectedMember(member);
                              setAdminModalVisible(true);
                            }
                          }}
                        >
                          <Text style={styles.memberName}>{member.name}</Text>
                          <Text style={styles.memberEmail}>{member.email}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            {member.isAdmin && (
                              <Text style={styles.adminBadge}>Admin</Text>
                            )}
                            <Text style={{ fontSize: 11, color: '#aaa' }}>
                              Joined: {formatDate(member.joinedAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        {isAdmin && member.email !== user?.email && (
                          <TouchableOpacity
                            onPress={() => removeMember(selectedGroup.id, member.email)}
                          >
                            <Ionicons name="person-remove" size={20} color="#f87171" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}

                    {isAdmin && (
                      <View style={styles.addMemberSection}>
                        <Text style={styles.addMemberTitle}>Add New Member</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Name"
                          placeholderTextColor="#888"
                          value={newMember.name}
                          onChangeText={text => setNewMember({ ...newMember, name: text })}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Email"
                          placeholderTextColor="#888"
                          value={newMember.email}
                          onChangeText={text => setNewMember({ ...newMember, email: text })}
                          keyboardType="email-address"
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Phone (optional)"
                          placeholderTextColor="#888"
                          value={newMember.phone}
                          onChangeText={text => setNewMember({ ...newMember, phone: text })}
                          keyboardType="phone-pad"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <TouchableOpacity
                            style={[styles.addButton, { flex: 0.48 }]}
                            onPress={addMemberToGroup}
                          >
                            <Text style={styles.addButtonText}>Add Member</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.addButton, { flex: 0.48, backgroundColor: '#525760' }]}
                            onPress={() => {
                              getContacts();
                              setContactsModalVisible(true);
                            }}
                          >
                            <Text style={styles.addButtonText}>From Contacts</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.section}>
                    <TouchableOpacity
                      style={styles.expensesButton}
                      onPress={() => navigateToExpenses(selectedGroup.id)}
                    >
                      <Ionicons name="cash-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>View Expenses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.leaveButton}
                      onPress={() => leaveGroup(selectedGroup.id)}
                    >
                      <Ionicons name="exit-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Leave Group</Text>
                    </TouchableOpacity>

                    {isAdmin && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteGroup(selectedGroup.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Delete Group</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>
              {/* Keep the existing details content here */}
            </ScrollView>
          ) : (
            <Chat groupId={selectedGroup.id} members={selectedGroup.members} />
          )}

        </View>

      </Modal>
    );
  };

  // Create group modal
  const renderCreateGroupModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={createGroupModalVisible}
        onRequestClose={() => {
          setCreateGroupModalVisible(false);
          setNewGroup({ name: '', description: '' });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setCreateGroupModalVisible(false);
                setNewGroup({ name: '', description: '' });
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name"
              placeholderTextColor="#888"
              value={newGroup.name}
              onChangeText={text => setNewGroup({ ...newGroup, name: text })}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter group description (optional)"
              placeholderTextColor="#888"
              value={newGroup.description}
              onChangeText={text => setNewGroup({ ...newGroup, description: text })}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.createButton}
              onPress={createGroup}
            >
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Contacts modal
  const renderContactsModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={contactsModalVisible}
        onRequestClose={() => setContactsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setContactsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Contact</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.memberItem}
                onPress={() => addContactAsMember(item)}
              >
                <View>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {item.email && <Text style={styles.memberEmail}>{item.email}</Text>}
                  {item.phone && <Text style={styles.memberEmail}>{item.phone}</Text>}
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#60a5fa" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#fff' }}>No contacts found</Text>
              </View>
            )}
          />
        </View>
      </Modal>
    );
  };

  // Admin management modal
  const renderAdminModal = () => {
    if (!selectedMember) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={adminModalVisible}
        onRequestClose={() => {
          setAdminModalVisible(false);
          setSelectedMember(null);
        }}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <View style={{
            width: '80%',
            backgroundColor: '#333940',
            borderRadius: 12,
            padding: 20,
            alignItems: 'center'
          }}>
            <Text style={{ color: '#fff', fontSize: 18, marginBottom: 15 }}>
              Manage {selectedMember.name}
            </Text>

            <TouchableOpacity
              style={[styles.addButton, { marginBottom: 10 }]}
              onPress={() => toggleAdminStatus(selectedMember)}
            >
              <Text style={styles.addButtonText}>
                {selectedMember.isAdmin ? 'Remove Admin Role' : 'Make Admin'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: '#525760' }]}
              onPress={() => {
                setAdminModalVisible(false);
                setSelectedMember(null);
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Authentication check
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Please log in to view your groups</Text>
      </View>
    );
  }

  // Main render
  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#60a5fa" />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Groups</Text>
            <TouchableOpacity
              style={styles.addGroupButton}
              onPress={() => setCreateGroupModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#60a5fa" />
              <Text style={styles.emptyStateText}>
                You don't have any groups yet
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Create a group to start tracking expenses with friends
              </Text>
              <TouchableOpacity
                style={styles.createFirstGroupButton}
                onPress={() => setCreateGroupModalVisible(true)}
              >
                <Text style={styles.createFirstGroupButtonText}>
                  Create Your First Group
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={groups}
              renderItem={renderGroupItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
            />
          )}

          {renderGroupDetailsModal()}
          {renderCreateGroupModal()}
          {renderContactsModal()}
          {renderAdminModal()}
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
  addGroupButton: {
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
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333940',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  groupItemContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  memberCount: {
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
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  memberEmail: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  adminBadge: {
    fontSize: 12,
    color: '#60a5fa',
    marginTop: 4,
  },
  addMemberSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#333940',
    borderRadius: 12,
  },
  addMemberTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
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
  expensesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#525760',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
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
  createFirstGroupButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  createFirstGroupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  text: {
    color: '#fff',
  },


  // Add to the styles object at the bottom of the file
  tabContainer: {
    backgroundColor: '#333940',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#60a5fa',
  },
  tabText: {
    color: '#aaa',
    fontSize: 16,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});