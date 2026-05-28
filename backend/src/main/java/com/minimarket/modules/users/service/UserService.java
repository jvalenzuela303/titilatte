package com.minimarket.modules.users.service;

import com.minimarket.modules.users.dto.CreateUserRequest;
import com.minimarket.modules.users.dto.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface UserService {

    UserResponse create(CreateUserRequest request);

    UserResponse findById(UUID id);

    Page<UserResponse> findAll(String email, String firstName, Pageable pageable);

    UserResponse deactivate(UUID id);

    void delete(UUID id);
}
