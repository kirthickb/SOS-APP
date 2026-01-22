package com.sos.controller;

import com.sos.dto.AvailabilityRequest;
import com.sos.dto.DriverProfileRequest;
import com.sos.dto.DriverProfileResponse;
import com.sos.dto.LocationUpdateRequest;
import com.sos.service.DriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/driver")
@RequiredArgsConstructor
public class DriverController {

    private final DriverService driverService;

    @PostMapping("/profile")
    public ResponseEntity<DriverProfileResponse> createOrUpdateProfile(@Valid @RequestBody DriverProfileRequest request) {
        return ResponseEntity.ok(driverService.createOrUpdateProfile(request));
    }

    @GetMapping("/profile")
    public ResponseEntity<DriverProfileResponse> getProfile() {
        return ResponseEntity.ok(driverService.getProfile());
    }

    @PostMapping("/availability")
    public ResponseEntity<DriverProfileResponse> updateAvailability(@Valid @RequestBody AvailabilityRequest request) {
        return ResponseEntity.ok(driverService.updateAvailability(request));
    }

    @PostMapping("/location")
    public ResponseEntity<DriverProfileResponse> updateLocation(@Valid @RequestBody LocationUpdateRequest request) {
        return ResponseEntity.ok(driverService.updateLocation(request));
    }
}
