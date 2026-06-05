package com.minimarket.modules.periodclose.controller;

import com.minimarket.modules.periodclose.dto.MonthlyComparisonDto;
import com.minimarket.modules.periodclose.dto.PeriodCloseRequest;
import com.minimarket.modules.periodclose.dto.PeriodCloseResponse;
import com.minimarket.modules.periodclose.service.PeriodCloseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/period-closes")
@RequiredArgsConstructor
@Tag(name = "Period Close", description = "Monthly accounting period close management")
public class PeriodCloseController {

    private final PeriodCloseService periodCloseService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all period closes, most recent first")
    public ResponseEntity<Page<PeriodCloseResponse>> findAll(
            @PageableDefault(size = 12, sort = {"periodYear", "periodMonth"}, direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(periodCloseService.findAll(pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get a specific period close by ID")
    public ResponseEntity<PeriodCloseResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(periodCloseService.findById(id));
    }

    @GetMapping("/preview")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Preview period close aggregates without persisting")
    public ResponseEntity<PeriodCloseResponse> preview(
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(required = false) UUID branchId) {
        return ResponseEntity.ok(periodCloseService.preview(year, month, branchId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Close a period — computes and persists all financial aggregates")
    public ResponseEntity<PeriodCloseResponse> closePeriod(
            @Valid @RequestBody PeriodCloseRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(periodCloseService.closePeriod(request, currentUser.getUsername()));
    }

    @GetMapping("/comparison")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPERVISOR')")
    @Operation(summary = "Get monthly revenue/profit comparison for the last N months")
    public ResponseEntity<List<MonthlyComparisonDto>> getComparison(
            @RequestParam(defaultValue = "12") int months,
            @RequestParam(required = false) UUID branchId) {
        return ResponseEntity.ok(periodCloseService.getComparison(months, branchId));
    }

    @GetMapping("/{id}/export/excel")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export period close as Excel file (requires Apache POI)")
    public ResponseEntity<byte[]> exportExcel(@PathVariable UUID id) {
        byte[] data = periodCloseService.exportExcel(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "period-close-" + id + ".xlsx");
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
