package com.sos.controller;

import com.sos.dto.SOSCreateRequest;
import com.sos.dto.SOSResponse;
import com.sos.service.SOSService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sos")
@RequiredArgsConstructor
public class SOSController {

    private final SOSService sosService;

    @PostMapping
    public ResponseEntity<SOSResponse> createSOS(@Valid @RequestBody SOSCreateRequest request) {
        return ResponseEntity.ok(sosService.createSOS(request));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<SOSResponse>> getNearbySOS(
            @RequestParam Double lat,
            @RequestParam Double lng,
            @RequestParam(defaultValue = "5") Double radius
    ) {
        // Validate coordinates
        if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new IllegalArgumentException("Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180");
        }
        
        // Validate radius (max 50km)
        if (radius == null || radius <= 0 || radius > 50) {
            throw new IllegalArgumentException("Radius must be between 0 and 50 km");
        }
        
        return ResponseEntity.ok(sosService.getNearbySOS(lat, lng, radius));
    }
    
    @PostMapping("/{id}/accept")
    public ResponseEntity<SOSResponse> acceptSOS(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.acceptSOS(id));
    }

    @PostMapping("/{id}/arrived")
    public ResponseEntity<SOSResponse> markPatientArrived(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.markPatientArrived(id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<SOSResponse> completeSOS(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.completeSOS(id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<SOSResponse> cancelSOS(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.cancelSOS(id));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SOSResponse> getSOS(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.getSOS(id));
    }
}
