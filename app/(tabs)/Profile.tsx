
import React, { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { router } from 'expo-router';

import * as Contacts from 'expo-contacts';

// Define Contact interface
interface Contact {
  id: string | undefined;
  name: string;
  phoneNumber: string;
  image?: string;
}

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Load contacts if permission is granted
  const loadContacts = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        
        if (data.length > 0) {
          // Transform contacts data to our Contact interface
          const formattedContacts: Contact[] = data
            .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
            // .slice(0, 10) // Limit to 10 contacts for demo purposes
            .map(contact => ({
              id: contact.id,
              name: contact.name || 'Unknown',
              phoneNumber: contact.phoneNumbers ? 
                (contact.phoneNumbers[0].number || 'No number') : 
                'No number',
            }));
          
          setContacts(formattedContacts);
        } else {
          Alert.alert('No contacts found', 'Your contacts list appears to be empty.');
        }
      } else {
        Alert.alert(
          'Permission Required', 
          'Please allow access to your contacts to use this feature.'
        );
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts from your device.');
    } finally {
      setLoading(false);
    }
  };

  // Render contact item
  const renderContactItem = ({ item }: { item: Contact }) => (
    
    <View style={styles.contactItem}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity style={styles.contactAction}>
        <Ionicons name="call-outline" size={20} color="#60a5fa" />
      </TouchableOpacity>
    </View>
  );
  
  const handleLogout = async () => {
    try {
      console.log("logout attemped",auth)
      await signOut(auth);

      router.replace("/login");
      // The layout component will handle the navigation to login screen
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: handleLogout }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            {/* Display user profile image if available, otherwise show placeholder */}
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={40} color="#60a5fa" />
              </View>
            )}
          </View>

          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="person-outline" size={24} color="#60a5fa" style={styles.menuIcon} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </TouchableOpacity>

        </View>

        {/* Contacts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contacts</Text>
            <TouchableOpacity 
              style={styles.sectionButton}
              onPress={loadContacts}
            >
              <Text style={styles.sectionButtonText}>
                {contacts.length > 0 ? 'Refresh' : 'Load Contacts'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color="#60a5fa" style={styles.loader} />
          ) : contacts.length > 0 ? (
            <View style={styles.contactsContainer}>
            <FlatList 
              data={contacts}
              keyExtractor={(item, index) => item.id || index.toString()}
              renderItem={renderContactItem}            
              contentContainerStyle={styles.contactsContainer}
            />

              {/* {contacts.map(contact => renderContactItem({ item: contact }))} */}
            </View>
          ) : (
            <View style={styles.emptyContacts}>
              <Ionicons name="people-outline" size={48} color="#60a5fa" />
              <Text style={styles.emptyContactsText}>
                No contacts loaded
              </Text>
              <Text style={styles.emptyContactsSubtext}>
                Tap the button above to load your contacts
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={24} color="#60a5fa" style={styles.menuIcon} />
            <Text style={styles.menuText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="star-outline" size={24} color="#60a5fa" style={styles.menuIcon} />
            <Text style={styles.menuText}>Rate the App</Text>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={confirmLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  header: {
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
  scrollContainer: {
    flex: 1,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#333940',
    borderRadius: 16,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3a3f44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#aaa',
  },
  section: {
    marginBottom: 24,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  sectionButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sectionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  contactsContainer: {
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f44',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333940',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60a5fa',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#aaa',
  },
  contactAction: {
    padding: 8,
  },
  emptyContacts: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyContactsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyContactsSubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f87171',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
});