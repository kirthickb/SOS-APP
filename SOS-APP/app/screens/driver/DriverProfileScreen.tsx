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
import apiService from '../../services/api';
import { DriverProfile } from '../../types';

const DriverProfileScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<DriverProfile>({
    vehicleNumber: '',
    serviceCity: '',
    isAvailable: false,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await apiService.getDriverProfile();
      setProfile(data);
    } catch (error) {
      console.log('No profile found, creating new one');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profile.vehicleNumber || !profile.serviceCity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await apiService.createOrUpdateDriverProfile(profile);
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
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Driver Information</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Vehicle Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., AMB-1234"
            value={profile.vehicleNumber}
            onChangeText={(text) => setProfile({ ...profile, vehicleNumber: text.toUpperCase() })}
            autoCapitalize="characters"
          />
          <Text style={styles.hint}>Enter your ambulance registration number</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Service City *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mumbai"
            value={profile.serviceCity}
            onChangeText={(text) => setProfile({ ...profile, serviceCity: text })}
          />
          <Text style={styles.hint}>City where you provide ambulance services</Text>
        </View>

        {profile.id && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📍 Location Status</Text>
            <Text style={styles.infoText}>
              Your location is automatically updated when you go online. This helps
              patients find the nearest available ambulance.
            </Text>
          </View>
        )}

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

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Tips for Drivers</Text>
          <View style={styles.tip}>
            <Text style={styles.tipNumber}>•</Text>
            <Text style={styles.tipText}>
              Keep your vehicle number and documents up to date
            </Text>
          </View>
          <View style={styles.tip}>
            <Text style={styles.tipNumber}>•</Text>
            <Text style={styles.tipText}>
              Go online only when you're ready to respond to emergencies
            </Text>
          </View>
          <View style={styles.tip}>
            <Text style={styles.tipNumber}>•</Text>
            <Text style={styles.tipText}>
              Keep your location services enabled for accurate tracking
            </Text>
          </View>
          <View style={styles.tip}>
            <Text style={styles.tipNumber}>•</Text>
            <Text style={styles.tipText}>
              Respond to emergencies as quickly as possible
            </Text>
          </View>
        </View>
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
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
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
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12,
  },
  tip: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipNumber: {
    color: '#92400E',
    fontSize: 14,
    marginRight: 8,
    fontWeight: 'bold',
  },
  tipText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default DriverProfileScreen;
