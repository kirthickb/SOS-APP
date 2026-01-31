package com.sos.service;

import com.sos.dto.SOSCreateRequest;
import com.sos.dto.SOSResponse;
import com.sos.entity.SOSRequest;
import com.sos.entity.SOSStatus;
import com.sos.entity.User;
import com.sos.entity.UserRole;
import com.sos.exception.ResourceNotFoundException;
import com.sos.exception.UnauthorizedException;
import com.sos.repository.SOSRequestRepository;
import com.sos.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SOSService {

    private final SOSRequestRepository sosRequestRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private User getCurrentUser() {
        String phone = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new ResourceNotFoundException("User", "phone", phone));
    }

    @Transactional
    public SOSResponse createSOS(SOSCreateRequest request) {
        User client = getCurrentUser();

        if (client.getRole() != UserRole.CLIENT) {
            log.warn("Non-client user attempted to create SOS: {}", client.getPhone());
            throw new UnauthorizedException("Only clients can create SOS requests");
        }

        SOSRequest sosRequest = SOSRequest.builder()
                .client(client)
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status(SOSStatus.PENDING)
                .build();

        sosRequest = sosRequestRepository.save(sosRequest);
        
        log.info("SOS request created: id={}, client={}, lat={}, lng={}", 
                sosRequest.getId(), client.getPhone(), request.getLatitude(), request.getLongitude());

        SOSResponse response = mapToResponse(sosRequest);

        // Broadcast to all drivers via WebSocket (only PENDING SOS)
        messagingTemplate.convertAndSend("/topic/sos", response);

        return response;
    }

    public List<SOSResponse> getNearbySOS(Double latitude, Double longitude, Double radius) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            log.warn("Non-driver user attempted to view nearby SOS: {}", driver.getPhone());
            throw new UnauthorizedException("Only drivers can view nearby SOS requests");
        }

        List<SOSRequest> sosRequests = sosRequestRepository.findNearbySOS(
                latitude, longitude, radius, SOSStatus.PENDING
        );

        log.debug("Found {} nearby SOS requests for driver: {}", sosRequests.size(), driver.getPhone());
        
        return sosRequests.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SOSResponse acceptSOS(Long sosId) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            log.warn("Non-driver user attempted to accept SOS: {}", driver.getPhone());
            throw new UnauthorizedException("Only drivers can accept SOS requests");
        }

        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS", "id", sosId));

        if (sosRequest.getStatus() != SOSStatus.PENDING) {
            log.warn("Driver {} attempted to accept non-PENDING SOS {}: current status={}", 
                    driver.getPhone(), sosId, sosRequest.getStatus());
            throw new IllegalArgumentException(
                "SOS request already accepted or completed. Current status: " + sosRequest.getStatus()
            );
        }

        sosRequest.setStatus(SOSStatus.ACCEPTED);
        sosRequest.setAcceptedDriver(driver);
        sosRequest = sosRequestRepository.save(sosRequest);
        
        log.info("SOS {} accepted by driver: {}", sosId, driver.getPhone());

        SOSResponse response = mapToResponse(sosRequest);
        
        // Notify all interested parties
        messagingTemplate.convertAndSend("/topic/sos", response);
        messagingTemplate.convertAndSend("/user/" + sosRequest.getClient().getId() + "/topic/sos", response);

        return response;
    }

    @Transactional
    public SOSResponse markPatientArrived(Long sosId) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            log.warn("Non-driver user attempted to mark arrived: {}", driver.getPhone());
            throw new UnauthorizedException("Only drivers can update SOS status");
        }

        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS", "id", sosId));

        // Verify this is the assigned driver
        if (sosRequest.getAcceptedDriver() == null || !sosRequest.getAcceptedDriver().getId().equals(driver.getId())) {
            log.warn("Driver {} attempted to update SOS {} assigned to another driver", driver.getPhone(), sosId);
            throw new UnauthorizedException("Only the assigned driver can update this SOS");
        }
        
        if (sosRequest.getStatus() != SOSStatus.ACCEPTED) {
            log.warn("Cannot mark ARRIVED - SOS {} not in ACCEPTED state. Current: {}", sosId, sosRequest.getStatus());
            throw new IllegalArgumentException(
                "Cannot mark arrived - SOS not in accepted state. Current status: " + sosRequest.getStatus()
            );
        }

        sosRequest.setStatus(SOSStatus.ARRIVED);
        sosRequest.setArrivedAt(LocalDateTime.now());
        sosRequest = sosRequestRepository.save(sosRequest);
        
        log.info("SOS {} marked as ARRIVED by driver: {}", sosId, driver.getPhone());

        SOSResponse response = mapToResponse(sosRequest);
        messagingTemplate.convertAndSend("/topic/sos", response);
        messagingTemplate.convertAndSend("/user/" + sosRequest.getClient().getId() + "/topic/sos", response);

        return response;
    }

    @Transactional
    public SOSResponse completeSOS(Long sosId) {
        User driver = getCurrentUser();

        if (driver.getRole() != UserRole.DRIVER) {
            log.warn("Non-driver user attempted to complete SOS: {}", driver.getPhone());
            throw new UnauthorizedException("Only drivers can complete SOS");
        }

        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS", "id", sosId));

        // Verify this is the assigned driver
        if (sosRequest.getAcceptedDriver() == null || !sosRequest.getAcceptedDriver().getId().equals(driver.getId())) {
            log.warn("Driver {} attempted to complete SOS {} assigned to another driver", driver.getPhone(), sosId);
            throw new UnauthorizedException("Only the assigned driver can complete this SOS");
        }
        
        if (sosRequest.getStatus() != SOSStatus.ARRIVED) {
            log.warn("Cannot complete SOS {} - patient not picked up. Current: {}", sosId, sosRequest.getStatus());
            throw new IllegalArgumentException(
                "Cannot complete - patient must be picked up first (ARRIVED status required). Current status: " + sosRequest.getStatus()
            );
        }

        sosRequest.setStatus(SOSStatus.COMPLETED);
        sosRequest.setCompletedAt(LocalDateTime.now());
        sosRequest = sosRequestRepository.save(sosRequest);
        
        log.info("SOS {} completed by driver: {}", sosId, driver.getPhone());

        SOSResponse response = mapToResponse(sosRequest);
        messagingTemplate.convertAndSend("/topic/sos", response);
        messagingTemplate.convertAndSend("/user/" + sosRequest.getClient().getId() + "/topic/sos", response);

        return response;
    }

    @Transactional
    public SOSResponse cancelSOS(Long sosId) {
        User client = getCurrentUser();

        if (client.getRole() != UserRole.CLIENT) {
            log.warn("Non-client user attempted to cancel SOS: {}", client.getPhone());
            throw new UnauthorizedException("Only clients can cancel SOS requests");
        }

        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS", "id", sosId));

        // Verify the client owns this SOS
        if (!sosRequest.getClient().getId().equals(client.getId())) {
            log.warn("Client {} attempted to cancel SOS {} belonging to client {}", 
                    client.getPhone(), sosId, sosRequest.getClient().getPhone());
            throw new UnauthorizedException("You can only cancel your own SOS requests");
        }

        // Can only cancel if not already completed
        if (sosRequest.getStatus() == SOSStatus.COMPLETED) {
            log.warn("Client {} attempted to cancel already completed SOS: {}", client.getPhone(), sosId);
            throw new IllegalArgumentException("Cannot cancel a completed SOS request");
        }

        sosRequest.setStatus(SOSStatus.CANCELLED);
        sosRequest.setCancelledAt(LocalDateTime.now());
        sosRequest = sosRequestRepository.save(sosRequest);
        
        log.info("SOS {} cancelled by client: {}", sosId, client.getPhone());

        SOSResponse response = mapToResponse(sosRequest);
        
        // Broadcast cancellation to all drivers so they remove it from their list
        messagingTemplate.convertAndSend("/topic/sos", response);
        
        // Notify assigned driver if one exists
        if (sosRequest.getAcceptedDriver() != null) {
            messagingTemplate.convertAndSend(
                "/user/" + sosRequest.getAcceptedDriver().getId() + "/topic/sos", 
                response
            );
        }

        return response;
    }

    public SOSResponse getSOS(Long sosId) {
        User currentUser = getCurrentUser();
        
        SOSRequest sosRequest = sosRequestRepository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS", "id", sosId));
        
        // Authorization check - only client or assigned driver can view
        if (!sosRequest.getClient().getId().equals(currentUser.getId()) && 
            (sosRequest.getAcceptedDriver() == null || !sosRequest.getAcceptedDriver().getId().equals(currentUser.getId()))) {
            log.warn("User {} attempted unauthorized access to SOS {}", currentUser.getPhone(), sosId);
            throw new UnauthorizedException("You are not authorized to view this SOS request");
        }
        
        return mapToResponse(sosRequest);
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
