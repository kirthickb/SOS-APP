package com.sos.service;

import com.sos.dto.ClientProfileRequest;
import com.sos.dto.ClientProfileResponse;
import com.sos.entity.ClientProfile;
import com.sos.entity.User;
import com.sos.repository.ClientProfileRepository;
import com.sos.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientProfileRepository clientProfileRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        String phone = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public ClientProfileResponse createOrUpdateProfile(ClientProfileRequest request) {
        User user = getCurrentUser();

        ClientProfile profile = clientProfileRepository.findByUser(user)
                .orElse(ClientProfile.builder().user(user).build());

        profile.setAge(request.getAge());
        profile.setGender(request.getGender());
        profile.setBloodGroup(request.getBloodGroup());
        profile.setAddress(request.getAddress());
        profile.setCity(request.getCity());
        profile.setState(request.getState());
        profile.setRelativeName(request.getRelativeName());
        profile.setRelativePhone(request.getRelativePhone());
        profile.setMedicalNotes(request.getMedicalNotes());

        profile = clientProfileRepository.save(profile);

        return mapToResponse(profile);
    }

    public ClientProfileResponse getProfile() {
        User user = getCurrentUser();
        ClientProfile profile = clientProfileRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Profile not found"));
        return mapToResponse(profile);
    }

    private ClientProfileResponse mapToResponse(ClientProfile profile) {
        return ClientProfileResponse.builder()
                .id(profile.getId())
                .age(profile.getAge())
                .gender(profile.getGender())
                .bloodGroup(profile.getBloodGroup())
                .address(profile.getAddress())
                .city(profile.getCity())
                .state(profile.getState())
                .relativeName(profile.getRelativeName())
                .relativePhone(profile.getRelativePhone())
                .medicalNotes(profile.getMedicalNotes())
                .build();
    }
}
