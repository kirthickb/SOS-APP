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
        return ResponseEntity.ok(sosService.getNearbySOS(lat, lng, radius));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<SOSResponse> acceptSOS(@PathVariable Long id) {
        return ResponseEntity.ok(sosService.acceptSOS(id));
    }
}
