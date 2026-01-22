import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiService from '../../services/api';
import { ClientProfile } from '../../types';

const ClientProfileScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<ClientProfile>({
    address: '',
    city: '',
    state: '',
    relativeName: '',
    relativePhone: '',
    age: undefined,
    gender: '',
    bloodGroup: '',
    medicalNotes: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await apiService.getClientProfile();
      setProfile(data);
    } catch (error) {
      console.log('No profile found, creating new one');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (
      !profile.address ||
      !profile.city ||
      !profile.state ||
      !profile.relativeName ||
      !profile.relativePhone
    ) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (profile.relativePhone.length !== 10) {
      Alert.alert('Error', 'Relative phone must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      await apiService.createOrUpdateClientProfile(profile);
      Alert.alert('Success', 'Profile saved successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Age"
              keyboardType="number-pad"
              value={profile.age?.toString() || ''}
              onChangeText={(text) => setProfile({ ...profile, age: parseInt(text) || undefined })}
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={profile.gender}
                onValueChange={(value) => setProfile({ ...profile, gender: value })}
                style={styles.picker}
              >
                <Picker.Item label="Select" value="" />
                <Picker.Item label="Male" value="Male" />
                <Picker.Item label="Female" value="Female" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Blood Group</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={profile.bloodGroup}
              onValueChange={(value) => setProfile({ ...profile, bloodGroup: value })}
              style={styles.picker}
            >
              <Picker.Item label="Select Blood Group" value="" />
              <Picker.Item label="A+" value="A+" />
              <Picker.Item label="A-" value="A-" />
              <Picker.Item label="B+" value="B+" />
              <Picker.Item label="B-" value="B-" />
              <Picker.Item label="AB+" value="AB+" />
              <Picker.Item label="AB-" value="AB-" />
              <Picker.Item label="O+" value="O+" />
              <Picker.Item label="O-" value="O-" />
            </Picker>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Address</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter full address"
            multiline
            numberOfLines={3}
            value={profile.address}
            onChangeText={(text) => setProfile({ ...profile, address: text })}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="City"
              value={profile.city}
              onChangeText={(text) => setProfile({ ...profile, city: text })}
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={styles.input}
              placeholder="State"
              value={profile.state}
              onChangeText={(text) => setProfile({ ...profile, state: text })}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Emergency Contact</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Relative Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter relative name"
            value={profile.relativeName}
            onChangeText={(text) => setProfile({ ...profile, relativeName: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Relative Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit phone number"
            keyboardType="phone-pad"
            maxLength={10}
            value={profile.relativePhone}
            onChangeText={(text) => setProfile({ ...profile, relativePhone: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Medical Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any medical conditions, allergies, etc."
            multiline
            numberOfLines={4}
            value={profile.medicalNotes}
            onChangeText={(text) => setProfile({ ...profile, medicalNotes: text })}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ClientProfileScreen;
