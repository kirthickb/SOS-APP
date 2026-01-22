package com.sos.controller;

import com.sos.dto.ClientProfileRequest;
import com.sos.dto.ClientProfileResponse;
import com.sos.service.ClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @PostMapping("/profile")
    public ResponseEntity<ClientProfileResponse> createOrUpdateProfile(@Valid @RequestBody ClientProfileRequest request) {
        return ResponseEntity.ok(clientService.createOrUpdateProfile(request));
    }

    @GetMapping("/profile")
    public ResponseEntity<ClientProfileResponse> getProfile() {
        return ResponseEntity.ok(clientService.getProfile());
    }
}
