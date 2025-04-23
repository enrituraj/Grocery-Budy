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
import { useLocalSearchParams, router } from 'expo-router';
import { auth, db } from '../../firebase';
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
  Timestamp,
  addDoc
} from 'firebase/firestore';

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

interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  splitType: 'equal' | 'custom';
  splitDetails?: {
    userId: string;
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface ExpenseSummary {
  userId: string;
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
}

interface Settlement {
  payer: string;
  payerName: string;
  receiver: string;
  receiverName: string;
  amount: number;
}

export default function ExpensesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaries, setSummaries] = useState<ExpenseSummary[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [expenseDetailsModalVisible, setExpenseDetailsModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    paidBy: '',
    splitType: 'equal' as 'equal' | 'custom',
  });

  const user = auth.currentUser;
  const currentUser = {
    id: user?.uid || '',
    name: user?.displayName || 'User',
    email: user?.email || '',
    phone: user?.phoneNumber || ''
  };

  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadExpenses();
    }
  }, [groupId]);

  useEffect(() => {
    if (group && expenses.length > 0) {
      calculateSummaries();
    }
  }, [group, expenses]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const groupRef = doc(db, 'groups', groupId as string);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        setGroup({
          id: groupDoc.id,
          name: groupData.name,
          description: groupData.description,
          members: groupData.members || [],
          createdBy: groupData.createdBy,
          createdAt: groupData.createdAt ? new Date(groupData.createdAt.toDate()).toISOString() : new Date().toISOString(),
          updatedAt: groupData.updatedAt ? new Date(groupData.updatedAt.toDate()).toISOString() : new Date().toISOString()
        });
      } else {
        Alert.alert('Error', 'Group not found');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load group data:', error);
      Alert.alert('Error', 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, where('groupId', '==', groupId));
      
      const querySnapshot = await getDocs(q);
      const expensesList: Expense[] = [];
      
      querySnapshot.forEach((doc) => {
        const expenseData = doc.data();
        expensesList.push({
          id: doc.id,
          groupId: expenseData.groupId,
          description: expenseData.description,
          amount: expenseData.amount,
          date: expenseData.date ? new Date(expenseData.date.toDate()).toISOString() : new Date().toISOString(),
          paidBy: expenseData.paidBy,
          splitType: expenseData.splitType,
          splitDetails: expenseData.splitDetails || [],
          createdAt: expenseData.createdAt ? new Date(expenseData.createdAt.toDate()).toISOString() : new Date().toISOString(),
          updatedAt: expenseData.updatedAt ? new Date(expenseData.updatedAt.toDate()).toISOString() : new Date().toISOString()
        });
      });
      
      setExpenses(expensesList);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaries = () => {
    if (!group) return;

    const memberSummaries: ExpenseSummary[] = group.members.map(member => ({
      userId: member.userId,
      name: member.name,
      totalPaid: 0,
      totalOwed: 0,
      balance: 0
    }));

    expenses.forEach(expense => {
      const payerSummary = memberSummaries.find(s => s.userId === expense.paidBy);
      if (payerSummary) {
        payerSummary.totalPaid += expense.amount;
      }

      if (expense.splitType === 'equal') {
        const splitAmount = expense.amount / group.members.length;
        memberSummaries.forEach(summary => {
          summary.totalOwed += splitAmount;
        });
        const payer = memberSummaries.find(s => s.userId === expense.paidBy);
        if (payer) {
          payer.totalOwed -= splitAmount;
        }
      } else if (expense.splitDetails && expense.splitDetails.length > 0) {
        expense.splitDetails.forEach(split => {
          const memberSummary = memberSummaries.find(s => s.userId === split.userId);
          if (memberSummary) {
            memberSummary.totalOwed += split.amount;
          }
        });
      }
    });

    memberSummaries.forEach(summary => {
      summary.balance = summary.totalPaid - summary.totalOwed;
    });

    setSummaries(memberSummaries);
    
    calculateSettlements(memberSummaries);
  };

  const calculateSettlements = (memberSummaries: ExpenseSummary[]) => {
    const settlements: Settlement[] = [];
    
    const members = [...memberSummaries];
    
    const positiveBalances = members.filter(m => m.balance > 0)
      .sort((a, b) => b.balance - a.balance); 
    
    const negativeBalances = members.filter(m => m.balance < 0)
      .sort((a, b) => a.balance - b.balance); 
    
    while (negativeBalances.length > 0 && positiveBalances.length > 0) {
      const payer = negativeBalances[0];
      const receiver = positiveBalances[0];
      
      const amount = Math.min(Math.abs(payer.balance), receiver.balance);
      
      if (amount > 0) {
        settlements.push({
          payer: payer.userId,
          payerName: payer.name,
          receiver: receiver.userId,
          receiverName: receiver.name,
          amount: amount
        });
      
        payer.balance += amount;
        receiver.balance -= amount;
      }
      
      if (Math.abs(payer.balance) < 0.01) {
        negativeBalances.shift();
      }
      
      if (Math.abs(receiver.balance) < 0.01) {
        positiveBalances.shift();
      }
    }
    
    setSettlements(settlements);
  };

  const addExpense = async () => {
    if (!group) return;
    
    if (!newExpense.description.trim()) {
      Alert.alert('Error', 'Description is required');
      return;
    }
    
    if (!newExpense.amount || isNaN(Number(newExpense.amount)) || Number(newExpense.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    const paidBy = newExpense.paidBy || currentUser.id;
    const timestamp = Timestamp.now();
    
    try {
      const expenseData:any = {
        groupId: groupId,
        description: newExpense.description,
        amount: Number(newExpense.amount),
        date: timestamp,
        paidBy: paidBy,
        splitType: newExpense.splitType,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      if (newExpense.splitType === 'custom') {
        expenseData.splitDetails = group.members
          .filter(member => member.userId !== paidBy)
          .map(member => ({
            userId: member.userId,
            amount: Number(newExpense.amount) / group.members.length
          }));
      }
      
      const expensesRef = collection(db, 'expenses');
      const docRef = await addDoc(expensesRef, expenseData);
      
      const newExpenseWithId: Expense = {
        id: docRef.id,
        ...expenseData,
        date: timestamp.toDate().toISOString(),
        createdAt: timestamp.toDate().toISOString(),
        updatedAt: timestamp.toDate().toISOString()
      };
      
      setExpenses([...expenses, newExpenseWithId]);
      
      setNewExpense({
        description: '',
        amount: '',
        paidBy: '',
        splitType: 'equal'
      });
      setAddExpenseModalVisible(false);
      
    } catch (error) {
      console.error('Failed to add expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'expenses', expenseId));
              
              const updatedExpenses = expenses.filter(expense => expense.id !== expenseId);
              setExpenses(updatedExpenses);
              setExpenseDetailsModalVisible(false);
              setSelectedExpense(null);
              
            } catch (error) {
              console.error('Failed to delete expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getMemberName = (userId: string) => {
    if (!group) return 'Unknown';
    const member = group.members.find(m => m.userId === userId);
    return member ? member.name : 'Unknown';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    return (
      <TouchableOpacity
        style={styles.expenseItem}
        onPress={() => {
          setSelectedExpense(item);
          setExpenseDetailsModalVisible(true);
        }}
      >
        <View style={styles.expenseItemBox}>
          <View style={styles.expenseItemContent}>

            <Text style={styles.expenseDescription}>{item.description}</Text>
            <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
            <Text style={styles.expensePaidBy}>
              Paid by {getMemberName(item.paidBy)}
            </Text>
          </View>

          <View style={styles.expenseAmountContainer}>
            <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAddExpenseModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={addExpenseModalVisible}
        onRequestClose={() => {
          setAddExpenseModalVisible(false);
          setNewExpense({
            description: '',
            amount: '',
            paidBy: '',
            splitType: 'equal'
          });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setAddExpenseModalVisible(false);
                setNewExpense({
                  description: '',
                  amount: '',
                  paidBy: '',
                  splitType: 'equal'
                });
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Expense</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput
              style={styles.input}
              placeholder="What was this expense for?"
              placeholderTextColor="#888"
              value={newExpense.description}
              onChangeText={text => setNewExpense({ ...newExpense, description: text })}
            />

            <Text style={styles.inputLabel}>Amount *</Text>
            <View style={styles.currencyInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor="#888"
                value={newExpense.amount}
                onChangeText={text => setNewExpense({ ...newExpense, amount: text })}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.inputLabel}>Paid By</Text>
            <View style={styles.paidByContainer}>
              <TouchableOpacity
                style={[
                  styles.paidByOption,
                  (!newExpense.paidBy || newExpense.paidBy === currentUser.id) && styles.paidByOptionSelected
                ]}
                onPress={() => setNewExpense({ ...newExpense, paidBy: currentUser.id })}
              >
                <Text style={styles.paidByOptionText}>You</Text>
              </TouchableOpacity>
              
              {group?.members
                .filter(member => member.userId !== currentUser.id)
                .map(member => (
                  <TouchableOpacity
                    key={member.userId}
                    style={[
                      styles.paidByOption,
                      newExpense.paidBy === member.userId && styles.paidByOptionSelected
                    ]}
                    onPress={() => setNewExpense({ ...newExpense, paidBy: member.userId })}
                  >
                    <Text style={styles.paidByOptionText}>{member.name}</Text>
                  </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.inputLabel}>Split Type</Text>
            <View style={styles.splitTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.splitTypeOption,
                  newExpense.splitType === 'equal' && styles.splitTypeOptionSelected
                ]}
                onPress={() => setNewExpense({ ...newExpense, splitType: 'equal' })}
              >
                <Text style={styles.splitTypeOptionText}>Split Equally</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.splitTypeOption,
                  newExpense.splitType === 'custom' && styles.splitTypeOptionSelected
                ]}
                onPress={() => setNewExpense({ ...newExpense, splitType: 'custom' })}
              >
                <Text style={styles.splitTypeOptionText}>Custom Split</Text>
              </TouchableOpacity>
            </View>

            {newExpense.splitType === 'custom' && (
              <Text style={styles.customSplitNote}>
                Note: Custom split is not fully implemented in this version.
              </Text>
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={addExpense}
            >
              <Text style={styles.addButtonText}>Add Expense</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderExpenseDetailsModal = () => {
    if (!selectedExpense) return null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={expenseDetailsModalVisible}
        onRequestClose={() => {
          setExpenseDetailsModalVisible(false);
          setSelectedExpense(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setExpenseDetailsModalVisible(false);
                setSelectedExpense(null);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Expense Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.expenseDetailHeader}>
              <Text style={styles.expenseDetailAmount}>
                {formatCurrency(selectedExpense.amount)}
              </Text>
              <Text style={styles.expenseDetailDescription}>
                {selectedExpense.description}
              </Text>
              <Text style={styles.expenseDetailDate}>
                {formatDate(selectedExpense.date)}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Paid by</Text>
                <Text style={styles.detailValue}>
                  {getMemberName(selectedExpense.paidBy)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Split type</Text>
                <Text style={styles.detailValue}>
                  {selectedExpense.splitType === 'equal' ? 'Equal' : 'Custom'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Split Details</Text>
              <View style={styles.splitDetailsList}>
                {group?.members.map(member => {
                  const isPayingMember = member.userId === selectedExpense.paidBy;
                  const amountPerPerson = selectedExpense.amount / (group?.members.length || 1);
                  
                  return (
                    <View key={member.userId} style={styles.splitDetailItem}>
                      <Text style={styles.splitDetailName}>{member.name}</Text>
                      {isPayingMember ? (
                        <Text style={styles.splitDetailPositive}>
                          +{formatCurrency(selectedExpense.amount - amountPerPerson)}
                        </Text>
                      ) : (
                        <Text style={styles.splitDetailNegative}>
                          -{formatCurrency(amountPerPerson)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {(currentUser.id === selectedExpense.paidBy || currentUser.id === group?.createdBy) && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteExpense(selectedExpense.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Delete Expense</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderSettlementModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={settlementModalVisible}
        onRequestClose={() => setSettlementModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSettlementModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How to Settle Up</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            {settlements.length > 0 ? (
              settlements.map((settlement, index) => (
                <View key={index} style={styles.settlementItem}>
                  <View style={styles.settlementNames}>
                    <Text style={styles.settlementPayer}>{settlement.payerName}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#60a5fa" style={{ marginHorizontal: 8 }} />
                    <Text style={styles.settlementReceiver}>{settlement.receiverName}</Text>
                  </View>
                  <Text style={styles.settlementAmount}>{formatCurrency(settlement.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSettlementsText}>Everyone is settled up! No payments needed.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderSummaryItem = ({ item }: { item: ExpenseSummary }) => {
    const isCurrentUser = item.userId === currentUser.id;
    return (
      <TouchableOpacity 
        style={styles.summaryItem}
        onPress={() => setSettlementModalVisible(true)}
      >
        <Text style={styles.summaryName}>
          {isCurrentUser ? 'You' : item.name}
        </Text>
        <View>
          {item.balance > 0 ? (
            <Text style={styles.positiveBalance}>
              Get back {formatCurrency(item.balance)}
            </Text>
          ) : item.balance < 0 ? (
            <Text style={styles.negativeBalance}>
              Owe {formatCurrency(Math.abs(item.balance))}
            </Text>
          ) : (
            <Text style={styles.neutralBalance}>All settled up</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#60a5fa" />
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {group?.name} Expenses
            </Text>
            <TouchableOpacity
              style={styles.addExpenseButton}
              onPress={() => setAddExpenseModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceSummaryContainer}>
            <View style={styles.summaryHeader}>
              <Text style={styles.balanceSummaryTitle}>Balance Summary</Text>
              <TouchableOpacity onPress={() => setSettlementModalVisible(true)}>
                <Text style={styles.settleUpText}>How to settle up?</Text>
              </TouchableOpacity>
            </View>
            
            {summaries.length > 0 ? (
              <FlatList
                data={summaries}
                renderItem={renderSummaryItem}
                keyExtractor={item => item.userId}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noExpensesText}>No expenses to calculate balances</Text>
            )}
          </View>

          <View style={styles.expensesContainer}>
            <Text style={styles.expensesTitle}>Recent Expenses</Text>
            {expenses.length > 0 ? (
              <FlatList
                data={expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
                renderItem={renderExpenseItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="cash-outline" size={64} color="#60a5fa" />
                <Text style={styles.emptyStateText}>
                  No expenses yet
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first expense to start tracking
                </Text>
                <TouchableOpacity
                  style={styles.addFirstExpenseButton}
                  onPress={() => setAddExpenseModalVisible(true)}
                >
                  <Text style={styles.addFirstExpenseButtonText}>
                    Add First Expense
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {renderAddExpenseModal()}
          {renderExpenseDetailsModal()}
          {renderSettlementModal()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#111827',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
  },
  addExpenseButton: {
    padding: 8,
  },
  balanceSummaryContainer: {
    backgroundColor: '#2d3748',
    padding: 16,
    borderRadius: 8,
    margin: 16,
    marginBottom: 0,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  settleUpText: {
    color: '#60a5fa',
    fontSize: 14,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  summaryName: {
    fontSize: 16,
    color: '#fff',
  },
  positiveBalance: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  negativeBalance: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  neutralBalance: {
    color: '#9ca3af',
  },
  expensesContainer: {
    flex: 1,
    padding: 16,
  },
  expensesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 16,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseItemBox:{
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    backgroundColor: '#374151',
    marginBottom: 8,
    borderRadius: 8,
    padding: 16,
  },
  expenseItemContent: {
    flex: 1,
    padding: 6,
  },
  expenseDescription: {    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  expensePaidBy: {
    fontSize: 14,
    color: '#60a5fa',
  },
  expenseAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
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
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstExpenseButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  addFirstExpenseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settlementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settlementNames: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementPayer: {
    fontSize: 16,
    color: '#f87171',
    fontWeight: 'bold',
  },
  settlementReceiver: {
    fontSize: 16,
    color: '#34d399',
    fontWeight: 'bold',
  },
  settlementAmount: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  noSettlementsText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
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
  inputLabel: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3a3f44',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: '#fff',
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3f44',
    borderRadius: 8,
    marginBottom: 16,
  },
  currencySymbol: {
    color: '#fff',
    fontSize: 16,
    paddingLeft: 12,
  },
  currencyInput: {
    flex: 1,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  paidByContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  paidByOption: {
    backgroundColor: '#3a3f44',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  paidByOptionSelected: {
    backgroundColor: '#60a5fa',
  },
  paidByOptionText: {
    color: '#fff',
  },
  splitTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  splitTypeOption: {
    flex: 1,
    backgroundColor: '#3a3f44',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  splitTypeOptionSelected: {
    backgroundColor: '#60a5fa',
  },
  splitTypeOptionText: {
    color: '#fff',
  },
  customSplitNote: {
    fontSize: 14,
    color: '#f87171',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  detailLabel: {
    fontSize: 16,
    color: '#aaa',
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f87171',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  expenseDetailHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  expenseDetailAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  expenseDetailDescription: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 4,
  },
  expenseDetailDate: {
    fontSize: 14,
    color: '#aaa',
  },
  splitDetailsList: {
    backgroundColor: '#333940',
    borderRadius: 12,
    padding: 8,
  },
  splitDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  splitDetailName: {
    fontSize: 16,
    color: '#fff',
  },
  splitDetailPositive: {
    fontSize: 16,
    color: '#34d399',
    fontWeight: 'bold',
  },
  splitDetailNegative: {
    fontSize: 16,
    color: '#f87171',
    fontWeight: 'bold',
  },
      noExpensesText: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
        marginTop: 12
      }
    });