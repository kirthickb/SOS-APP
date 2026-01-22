import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import apiService from '../../services/api';
import { SOSResponse } from '../../types';
import { calculateDistance, formatDistance, formatTimeAgo } from '../../utils/location';

type NavigationProp = NativeStackNavigationProp<DriverStackParamList>;

const DriverHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuth();
  const { subscribeToSOS, isConnected } = useSocket();
  
  const [isOnline, setIsOnline] = useState(false);
  const [sosList, setSosList] = useState<SOSResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    requestLocationPermission();
    
    // Subscribe to real-time SOS alerts
    const unsubscribe = subscribeToSOS((sos) => {
      console.log('New SOS received:', sos);
      // Add new SOS to the list if status is PENDING
      if (sos.status === 'PENDING') {
        setSosList((prev) => [sos, ...prev]);
        
        // Show notification
        Alert.alert(
          '🚨 New Emergency Alert',
          `Emergency alert from ${sos.clientName}`,
          [
            { text: 'Dismiss', style: 'cancel' },
            { text: 'View', onPress: () => {} },
          ]
        );
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOnline && currentLocation) {
      fetchNearbySOS();
      
      // Update location every 30 seconds
      const interval = setInterval(() => {
        updateDriverLocation();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isOnline, currentLocation]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
  };

  const toggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    
    try {
      await apiService.updateDriverAvailability({ isAvailable: newStatus });
      setIsOnline(newStatus);
      
      if (newStatus) {
        updateDriverLocation();
        fetchNearbySOS();
      } else {
        setSosList([]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const updateDriverLocation = async () => {
    if (!currentLocation) return;
    
    try {
      const location = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrentLocation(newLocation);
      await apiService.updateDriverLocation(newLocation);
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const fetchNearbySOS = async () => {
    if (!currentLocation) return;
    
    setLoading(true);
    try {
      const data = await apiService.getNearbySOS(
        currentLocation.latitude,
        currentLocation.longitude,
        10 // 10km radius
      );
      setSosList(data);
    } catch (error) {
      console.error('Error fetching SOS:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNearbySOS();
    setRefreshing(false);
  };

  const handleAcceptSOS = async (sosId: number) => {
    Alert.alert(
      'Accept Emergency',
      'Are you sure you want to accept this emergency request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => acceptSOS(sosId),
        },
      ]
    );
  };

  const acceptSOS = async (sosId: number) => {
    try {
      await apiService.acceptSOS(sosId);
      Alert.alert('Success', 'Emergency accepted. Navigate to patient now.', [
        {
          text: 'Navigate',
          onPress: () => navigation.navigate('DriverMap', { sosId }),
        },
      ]);
      
      // Remove from list
      setSosList((prev) => prev.filter((sos) => sos.id !== sosId));
    } catch (error: any) {
      Alert.alert('Failed', error.response?.data?.message || 'This emergency was already accepted');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const renderSOSCard = ({ item }: { item: SOSResponse }) => {
    const distance = currentLocation
      ? calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          item.latitude,
          item.longitude
        )
      : 0;

    return (
      <View style={styles.sosCard}>
        <View style={styles.sosHeader}>
          <View>
            <Text style={styles.sosName}>{item.clientName}</Text>
            <Text style={styles.sosTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <View style={styles.distanceBadge}>
            <Ionicons name="location" size={16} color="#DC2626" />
            <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
          </View>
        </View>

        <View style={styles.sosDetails}>
          <View style={styles.sosDetailItem}>
            <Ionicons name="call" size={16} color="#666" />
            <Text style={styles.sosDetailText}>{item.clientPhone}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptSOS(item.id)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>Accept Emergency</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Emergency Alerts</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            {isConnected && <Text style={styles.connectedText}> • Connected</Text>}
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.toggleButton, isOnline && styles.toggleButtonOnline]}
        onPress={toggleOnlineStatus}
      >
        <Ionicons
          name={isOnline ? 'pause-circle' : 'play-circle'}
          size={24}
          color="#fff"
        />
        <Text style={styles.toggleButtonText}>
          {isOnline ? 'Go Offline' : 'Go Online'}
        </Text>
      </TouchableOpacity>

      {!isOnline ? (
        <View style={styles.offlineContainer}>
          <Ionicons name="moon" size={64} color="#ccc" />
          <Text style={styles.offlineText}>You are offline</Text>
          <Text style={styles.offlineSubtext}>
            Go online to receive emergency alerts
          </Text>
        </View>
      ) : (
        <FlatList
          data={sosList}
          renderItem={renderSOSCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {loading ? (
                <ActivityIndicator size="large" color="#2563EB" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                  <Text style={styles.emptyText}>No active emergencies</Text>
                  <Text style={styles.emptySubtext}>
                    You'll be notified when someone needs help
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  connectedText: {
    fontSize: 14,
    color: '#10B981',
  },
  logoutButton: {
    padding: 8,
  },
  toggleButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },
  toggleButtonOnline: {
    backgroundColor: '#EF4444',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  sosCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sosName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sosTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 4,
  },
  sosDetails: {
    marginBottom: 12,
  },
  sosDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sosDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  offlineText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  offlineSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DriverHomeScreen;
