package com.sos.repository;

import com.sos.entity.DriverProfile;
import com.sos.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverProfileRepository extends JpaRepository<DriverProfile, Long> {
    Optional<DriverProfile> findByUser(User user);

    @Query("SELECT d FROM DriverProfile d WHERE d.isAvailable = true " +
           "AND d.currentLatitude IS NOT NULL AND d.currentLongitude IS NOT NULL " +
           "AND (6371 * acos(cos(radians(:lat)) * cos(radians(d.currentLatitude)) * " +
           "cos(radians(d.currentLongitude) - radians(:lng)) + " +
           "sin(radians(:lat)) * sin(radians(d.currentLatitude)))) <= :radius")
    List<DriverProfile> findNearbyAvailableDrivers(
            @Param("lat") Double latitude,
            @Param("lng") Double longitude,
            @Param("radius") Double radiusInKm
    );
}
