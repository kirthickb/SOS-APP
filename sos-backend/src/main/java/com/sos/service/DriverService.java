package com.sos.service;

import com.sos.dto.AvailabilityRequest;
import com.sos.dto.DriverProfileRequest;
import com.sos.dto.DriverProfileResponse;
import com.sos.dto.LocationUpdateRequest;
import com.sos.dto.SOSResponse;
import com.sos.entity.DriverProfile;
import com.sos.entity.SOSRequest;
import com.sos.entity.SOSStatus;
import com.sos.entity.User;
import com.sos.repository.DriverProfileRepository;
import com.sos.repository.SOSRequestRepository;
import com.sos.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {

    private final DriverProfileRepository driverProfileRepository;
    private final UserRepository userRepository;
    private final SOSRequestRepository sosRequestRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private User getCurrentUser() {
        String phone = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public DriverProfileResponse createOrUpdateProfile(DriverProfileRequest request) {
        User user = getCurrentUser();

        DriverProfile profile = driverProfileRepository.findByUser(user)
                .orElse(DriverProfile.builder().user(user).build());

        profile.setVehicleNumber(request.getVehicleNumber());
        profile.setServiceCity(request.getServiceCity());

        profile = driverProfileRepository.save(profile);

        return mapToResponse(profile);
    }

    public DriverProfileResponse getProfile() {
        User user = getCurrentUser();
        DriverProfile profile = driverProfileRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Profile not found"));
        return mapToResponse(profile);
    }

    @Transactional
    public DriverProfileResponse updateAvailability(AvailabilityRequest request) {
        User user = getCurrentUser();
        DriverProfile profile = driverProfileRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Profile not found"));

        profile.setIsAvailable(request.getIsAvailable());
        profile = driverProfileRepository.save(profile);

        return mapToResponse(profile);
    }

    @Transactional
    public DriverProfileResponse updateLocation(LocationUpdateRequest request) {
        User user = getCurrentUser();
        DriverProfile profile = driverProfileRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Profile not found"));

        profile.setCurrentLatitude(request.getLatitude());
        profile.setCurrentLongitude(request.getLongitude());
        profile = driverProfileRepository.save(profile);

        // Broadcast location update for any accepted SOS requests
        broadcastDriverLocationUpdate(user, request.getLatitude(), request.getLongitude());

        return mapToResponse(profile);
    }

    private void broadcastDriverLocationUpdate(User driver, Double latitude, Double longitude) {
        // Find all active SOS requests for this driver (ACCEPTED or ARRIVED)
        // Client needs real-time location during both states
        List<SOSRequest> activeRequests = sosRequestRepository.findByAcceptedDriverAndStatusIn(
                driver, List.of(SOSStatus.ACCEPTED, SOSStatus.ARRIVED)
        );

        System.out.println("📍 Broadcasting driver location update for " + activeRequests.size() + " active SOS requests");

        // Broadcast updated location for each active SOS request
        for (SOSRequest sosRequest : activeRequests) {
            SOSResponse response = SOSResponse.builder()
                    .id(sosRequest.getId())
                    .clientName(sosRequest.getClient().getName())
                    .clientPhone(sosRequest.getClient().getPhone())
                    .latitude(sosRequest.getLatitude())
                    .longitude(sosRequest.getLongitude())
                    .status(sosRequest.getStatus())
                    .acceptedDriverName(driver.getName())
                    .acceptedDriverPhone(driver.getPhone())
                    .driverLatitude(latitude)
                    .driverLongitude(longitude)
                    .createdAt(sosRequest.getCreatedAt())
                    .build();

            System.out.println("📡 Broadcasting location for SOS #" + sosRequest.getId() + " (status: " + sosRequest.getStatus() + ")");
            messagingTemplate.convertAndSend("/topic/sos", response);
            messagingTemplate.convertAndSend("/user/" + sosRequest.getClient().getId() + "/topic/sos", response);
        }
    }

    private DriverProfileResponse mapToResponse(DriverProfile profile) {
        return DriverProfileResponse.builder()
                .id(profile.getId())
                .vehicleNumber(profile.getVehicleNumber())
                .serviceCity(profile.getServiceCity())
                .isAvailable(profile.getIsAvailable())
                .currentLatitude(profile.getCurrentLatitude())
                .currentLongitude(profile.getCurrentLongitude())
                .build();
    }
}
