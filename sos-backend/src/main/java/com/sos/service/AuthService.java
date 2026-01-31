package com.sos.service;

import com.sos.dto.AuthResponse;
import com.sos.dto.LoginRequest;
import com.sos.dto.RegisterRequest;
import com.sos.entity.User;
import com.sos.exception.UserAlreadyExistsException;
import com.sos.repository.UserRepository;
import com.sos.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Check if phone already exists
        if (userRepository.existsByPhone(request.getPhone())) {
            log.warn("Registration attempt with existing phone: {}", request.getPhone());
            throw new UserAlreadyExistsException(
                "Phone number " + request.getPhone() + " is already registered"
            );
        }

        User user = User.builder()
                .name(request.getName())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isActive(true)
                .build();

        userRepository.save(user);
        
        log.info("User registered successfully: phone={}", request.getPhone());
        
        String token = jwtUtil.generateToken(user.getPhone());
        
        return AuthResponse.builder()
                .token(token)
                .role(user.getRole())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getPhone(),
                            request.getPassword()
                    )
            );
        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt: phone={}", request.getPhone());
            throw new BadCredentialsException("Invalid phone number or password", e);
        }

        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new BadCredentialsException("User not found"));

        log.info("User login successful: phone={}", request.getPhone());
        
        String token = jwtUtil.generateToken(user.getPhone());

        return AuthResponse.builder()
                .token(token)
                .role(user.getRole())
                .build();
    }
}
