package com.sos.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "driver_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriverProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "vehicle_number", nullable = false)
    private String vehicleNumber;

    @Column(name = "service_city", nullable = false)
    private String serviceCity;

    @Builder.Default
    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = false;

    @Column(name = "current_latitude")
    private Double currentLatitude;

    @Column(name = "current_longitude")
    private Double currentLongitude;
}
