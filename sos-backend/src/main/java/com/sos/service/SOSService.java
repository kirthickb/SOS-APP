package com.sos.service;

import com.sos.dto.SOSCreateRequest;
import com.sos.dto.SOSResponse;
import com.sos.entity.SOSRequest;
import com.sos.entity.SOSStatus;
import com.sos.entity.User;
import com.sos.entity.UserRole;
import com.sos.repository.SOSRequestRepository;
import com.sos.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SOSService {

    private final SOSRequestRepository sosRequestRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private User getCurrentUser() {
        String phone = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public SOSResponse createSOS(SOSCreateRequest request) {
        User client = getCurrentUser();

        if (client.getRole() != UserRole.CLIENT) {
            throw new RuntimeException("Only clients can create SOS requests");
        }

        SOSRequest sosRequest = SOSRequest.builder()
                .client(client)
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status(SOSStatus.PENDING)
                .build();

        sosRequest = sosRequestRepository.save(sosRequest);

        SOSResponse response = mapToResponse(sosRequest);

        // Broadcast to all drivers via WebSocket
        messagingTemplate.convertAndSend("/topic/sos", response);

        return response;
    }

    public List<SOSResponse> getNearbySOS(Double latitude, Double longitude, Double radius) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            throw new RuntimeException("Only drivers can view nearby SOS requests");
        }

        List<SOSRequest> sosRequests = sosRequestRepository.findNearbySOS(
                latitude, longitude, radius, SOSStatus.PENDING
        );

        return sosRequests.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SOSResponse acceptSOS(Long sosId) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            throw new RuntimeException("Only drivers can accept SOS requests");
        }

        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new RuntimeException("SOS request not found"));

        if (sosRequest.getStatus() != SOSStatus.PENDING) {
            throw new RuntimeException("SOS request already accepted or completed");
        }

        sosRequest.setStatus(SOSStatus.ACCEPTED);
        sosRequest.setAcceptedDriver(driver);
        sosRequest = sosRequestRepository.save(sosRequest);

        SOSResponse response = mapToResponse(sosRequest);
        
        // Broadcast the updated SOS with driver info via WebSocket
        messagingTemplate.convertAndSend("/topic/sos", response);

        return response;
    }
    
    private SOSResponse mapToResponse(SOSRequest request) {
        SOSResponse.SOSResponseBuilder builder = SOSResponse.builder()
                .id(request.getId())
                .clientName(request.getClient().getName())
                .clientPhone(request.getClient().getPhone())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status(request.getStatus())
                .acceptedDriverName(request.getAcceptedDriver() != null ? request.getAcceptedDriver().getName() : null)
                .acceptedDriverPhone(request.getAcceptedDriver() != null ? request.getAcceptedDriver().getPhone() : null)
                .createdAt(request.getCreatedAt());
        
        // Include driver location if driver has accepted
        if (request.getAcceptedDriver() != null && request.getAcceptedDriver().getDriverProfile() != null) {
            builder.driverLatitude(request.getAcceptedDriver().getDriverProfile().getCurrentLatitude());
            builder.driverLongitude(request.getAcceptedDriver().getDriverProfile().getCurrentLongitude());
        }
        
        return builder.build();
    }
}
