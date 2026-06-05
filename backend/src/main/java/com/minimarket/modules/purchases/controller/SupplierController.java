package com.minimarket.modules.purchases.controller;

import com.minimarket.modules.purchases.domain.Supplier;
import com.minimarket.modules.purchases.dto.SupplierResponse;
import com.minimarket.modules.purchases.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierRepository supplierRepository;

    @GetMapping
    public ResponseEntity<List<SupplierResponse>> findAll() {
        List<SupplierResponse> suppliers = supplierRepository.findAllByDeletedAtIsNull(Pageable.unpaged())
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(suppliers);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplierResponse> findById(@PathVariable UUID id) {
        return supplierRepository.findById(id)
                .filter(s -> s.getDeletedAt() == null)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'BODEGA')")
    public ResponseEntity<SupplierResponse> create(@RequestBody SupplierRequest request) {
        Supplier supplier = Supplier.builder()
                .name(request.name())
                .rut(request.rut())
                .contactName(request.contactName())
                .phone(request.phone())
                .email(request.email())
                .address(request.address())
                .active(request.active() != null ? request.active() : true)
                .build();
        return ResponseEntity.status(201).body(toResponse(supplierRepository.save(supplier)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'BODEGA')")
    public ResponseEntity<SupplierResponse> update(@PathVariable UUID id, @RequestBody SupplierRequest request) {
        return supplierRepository.findById(id)
                .filter(s -> s.getDeletedAt() == null)
                .map(s -> {
                    if (request.name() != null)        s.setName(request.name());
                    if (request.rut() != null)         s.setRut(request.rut());
                    if (request.contactName() != null) s.setContactName(request.contactName());
                    if (request.phone() != null)       s.setPhone(request.phone());
                    if (request.email() != null)       s.setEmail(request.email());
                    if (request.address() != null)     s.setAddress(request.address());
                    if (request.active() != null)      s.setActive(request.active());
                    return ResponseEntity.ok(toResponse(supplierRepository.save(s)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private SupplierResponse toResponse(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getRut(),
                s.getContactName(), s.getPhone(), s.getEmail(), s.getAddress(), s.isActive());
    }

    private record SupplierRequest(
            String name, String rut, String contactName,
            String phone, String email, String address, Boolean active) {}
}
