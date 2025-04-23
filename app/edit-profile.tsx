import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateProfile, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { router } from 'expo-router';

export default function EditProfileScreen() {
  const user = auth.currentUser;
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const hasChanges = () => {
    return (
      name !== (user?.displayName || '') ||
      email !== (user?.email || '') 
    );
  };

  const validateInputs = () => {
    let isValid = true;
    
    setNameError('');
    setEmailError('');
    
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    
    
    
    return isValid;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    
    try {
      if (!user) {
        Alert.alert('Error', 'No user is currently signed in');
        return;
      }
      
      // Update display name
      if (name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }
      
      if (email !== user.email) {
        if (showPasswordField && password) {
          try {
            const credential = EmailAuthProvider.credential(
              user.email || '',
              password
            );
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, email);
          } catch (error: any) {
            console.error("Re-authentication error:", error);
            setPasswordError('Incorrect password');
            setLoading(false);
            return;
          }
        } else {
          setShowPasswordField(true);
          setLoading(false);
          return;
        }
      }
      
    
      Alert.alert(
        'Success',
        'Profile updated successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Profile update error:", error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} /> {/* Empty view for header spacing */}
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.profileImageSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <Text style={styles.profileInitial}>{name.charAt(0) || 'U'}</Text>
            </View>
            <TouchableOpacity style={styles.cameraButton}>
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={[styles.textInput, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#aaa"
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.textInput, emailError ? styles.inputError : null]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>
          
          {showPasswordField && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <Text style={styles.inputDescription}>
                Please enter your current password to update your email address
              </Text>
              <TextInput
                style={[styles.textInput, passwordError ? styles.inputError : null]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#aaa"
                secureTextEntry={true}
              />
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>
          )}
          
          
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" style={styles.saveIcon} />
              <Text style={styles.saveText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  profileImageSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#333940',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#25292e',
  },
  changePhotoText: {
    fontSize: 16,
    color: '#60a5fa',
    fontWeight: '500',
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  inputDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#333940',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3a3f44',
  },
  inputError: {
    borderColor: '#f87171',
  },
  errorText: {
    color: '#f87171',
    marginTop: 4,
    fontSize: 14,
  },
  inputNote: {
    color: '#aaa',
    marginTop: 4,
    fontSize: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#3a3f44',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60a5fa',
    padding: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#3a3f44',
  },
  saveIcon: {
    marginRight: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});