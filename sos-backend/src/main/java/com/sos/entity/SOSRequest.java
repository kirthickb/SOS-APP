package com.sos.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "sos_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SOSRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "client_id", nullable = false)
    private User client;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SOSStatus status = SOSStatus.PENDING;

    @ManyToOne
    @JoinColumn(name = "accepted_driver_id")
    private User acceptedDriver;

    @Column
    private LocalDateTime arrivedAt; // When driver arrived at patient location

    @Column
    private LocalDateTime completedAt; // When emergency was completed

    @Column
    private LocalDateTime cancelledAt; // When client cancelled the request

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
