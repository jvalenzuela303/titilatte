package com.minimarket.modules.users.repository;

import com.minimarket.modules.users.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    @EntityGraph(attributePaths = "roles")
    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    boolean existsByEmailAndDeletedAtIsNull(String email);

    @EntityGraph(attributePaths = "roles")
    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    @Query("SELECT DISTINCT u FROM User u " +
           "JOIN FETCH u.roles " +
           "WHERE u.deletedAt IS NULL " +
           "AND (:email IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :email, '%'))) " +
           "AND (:firstName IS NULL OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :firstName, '%')))")
    Page<User> searchActive(
            @Param("email") String email,
            @Param("firstName") String firstName,
            Pageable pageable);
}
