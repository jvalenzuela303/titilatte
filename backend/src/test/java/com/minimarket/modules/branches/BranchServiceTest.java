package com.minimarket.modules.branches;

import com.minimarket.modules.branches.domain.Branch;
import com.minimarket.modules.branches.dto.BranchDto;
import com.minimarket.modules.branches.dto.BranchRequest;
import com.minimarket.modules.branches.repository.BranchRepository;
import com.minimarket.modules.branches.service.BranchServiceImpl;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BranchService - Unit Tests")
class BranchServiceTest {

    @Mock
    private BranchRepository branchRepository;

    @InjectMocks
    private BranchServiceImpl branchService;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private UUID branchId;
    private Branch existingBranch;

    @BeforeEach
    void setUp() {
        branchId = UUID.randomUUID();

        existingBranch = Branch.builder()
                .id(branchId)
                .name("Sucursal Centro")
                .address("Av. Principal 100, Santiago")
                .phone("+56212345678")
                .rut("76.543.210-K")
                .isActive(true)
                .build();
    }

    // ── findAll ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findAll()")
    class FindAll {

        @Test
        @DisplayName("findAll_returnsAllBranches — mock repository devuelve lista, verifica DTO mapping")
        void findAll_returnsAllBranches() {
            // Arrange
            Branch second = Branch.builder()
                    .id(UUID.randomUUID())
                    .name("Sucursal Norte")
                    .address("Calle Norte 200")
                    .phone("+56987654321")
                    .rut("12.345.678-9")
                    .isActive(true)
                    .build();

            when(branchRepository.findAll()).thenReturn(List.of(existingBranch, second));

            // Act
            List<BranchDto> result = branchService.findAll();

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).id()).isEqualTo(branchId);
            assertThat(result.get(0).name()).isEqualTo("Sucursal Centro");
            assertThat(result.get(0).address()).isEqualTo("Av. Principal 100, Santiago");
            assertThat(result.get(0).phone()).isEqualTo("+56212345678");
            assertThat(result.get(0).rut()).isEqualTo("76.543.210-K");
            assertThat(result.get(0).isActive()).isTrue();
            assertThat(result.get(1).name()).isEqualTo("Sucursal Norte");
            verify(branchRepository).findAll();
        }
    }

    // ── findById ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findById()")
    class FindById {

        @Test
        @DisplayName("findById_existingId_returnsDto — happy path")
        void findById_existingId_returnsDto() {
            // Arrange
            when(branchRepository.findById(branchId)).thenReturn(Optional.of(existingBranch));

            // Act
            BranchDto result = branchService.findById(branchId);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(branchId);
            assertThat(result.name()).isEqualTo("Sucursal Centro");
            assertThat(result.isActive()).isTrue();
            verify(branchRepository).findById(branchId);
        }

        @Test
        @DisplayName("findById_nonExistingId_throwsEntityNotFoundException")
        void findById_nonExistingId_throwsEntityNotFoundException() {
            // Arrange
            UUID missingId = UUID.randomUUID();
            when(branchRepository.findById(missingId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> branchService.findById(missingId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining(missingId.toString());

            verify(branchRepository).findById(missingId);
        }
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("create_validRequest_savesAndReturnsDto — verifica isActive=true en la entidad guardada")
        void create_validRequest_savesAndReturnsDto() {
            // Arrange
            BranchRequest request = new BranchRequest(
                    "Sucursal Sur",
                    "Av. Sur 500, Santiago",
                    "+56299998888",
                    "98.765.432-1"
            );

            Branch savedBranch = Branch.builder()
                    .id(UUID.randomUUID())
                    .name(request.name())
                    .address(request.address())
                    .phone(request.phone())
                    .rut(request.rut())
                    .isActive(true)
                    .build();

            when(branchRepository.save(any(Branch.class))).thenReturn(savedBranch);

            // Act
            BranchDto result = branchService.create(request);

            // Assert — result DTO maps correctly
            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("Sucursal Sur");
            assertThat(result.isActive()).isTrue();

            // Assert — saved entity has isActive = true
            ArgumentCaptor<Branch> captor = ArgumentCaptor.forClass(Branch.class);
            verify(branchRepository).save(captor.capture());
            Branch capturedBranch = captor.getValue();
            assertThat(capturedBranch.isActive()).isTrue();
            assertThat(capturedBranch.getName()).isEqualTo("Sucursal Sur");
            assertThat(capturedBranch.getAddress()).isEqualTo("Av. Sur 500, Santiago");
        }
    }

    // ── deactivate ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deactivate()")
    class Deactivate {

        @Test
        @DisplayName("deactivate_existingId_setsActiveFalse — verifica que branch.setActive(false) se llamó")
        void deactivate_existingId_setsActiveFalse() {
            // Arrange
            when(branchRepository.findById(branchId)).thenReturn(Optional.of(existingBranch));
            when(branchRepository.save(any(Branch.class))).thenReturn(existingBranch);

            // Act
            branchService.deactivate(branchId);

            // Assert — entity was saved with isActive = false
            ArgumentCaptor<Branch> captor = ArgumentCaptor.forClass(Branch.class);
            verify(branchRepository).save(captor.capture());
            assertThat(captor.getValue().isActive()).isFalse();
        }

        @Test
        @DisplayName("deactivate_nonExistingId_throwsEntityNotFoundException")
        void deactivate_nonExistingId_throwsEntityNotFoundException() {
            // Arrange
            UUID missingId = UUID.randomUUID();
            when(branchRepository.findById(missingId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> branchService.deactivate(missingId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining(missingId.toString());

            verify(branchRepository, never()).save(any());
        }
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update()")
    class Update {

        @Test
        @DisplayName("update_existingId_updatesFields — verifica que nombre/dirección/rut se actualizan")
        void update_existingId_updatesFields() {
            // Arrange
            BranchRequest request = new BranchRequest(
                    "Sucursal Centro Actualizada",
                    "Nueva Av. 999",
                    "+56211119999",
                    "11.111.111-1"
            );

            when(branchRepository.findById(branchId)).thenReturn(Optional.of(existingBranch));
            when(branchRepository.save(any(Branch.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            BranchDto result = branchService.update(branchId, request);

            // Assert — returned DTO reflects new values
            assertThat(result.name()).isEqualTo("Sucursal Centro Actualizada");
            assertThat(result.address()).isEqualTo("Nueva Av. 999");
            assertThat(result.phone()).isEqualTo("+56211119999");
            assertThat(result.rut()).isEqualTo("11.111.111-1");

            // Assert — entity fields were mutated before save
            ArgumentCaptor<Branch> captor = ArgumentCaptor.forClass(Branch.class);
            verify(branchRepository).save(captor.capture());
            Branch saved = captor.getValue();
            assertThat(saved.getName()).isEqualTo("Sucursal Centro Actualizada");
            assertThat(saved.getAddress()).isEqualTo("Nueva Av. 999");
            assertThat(saved.getRut()).isEqualTo("11.111.111-1");
        }

        @Test
        @DisplayName("update_nonExistingId_throwsEntityNotFoundException")
        void update_nonExistingId_throwsEntityNotFoundException() {
            // Arrange
            UUID missingId = UUID.randomUUID();
            BranchRequest request = new BranchRequest("X", null, null, null);
            when(branchRepository.findById(missingId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> branchService.update(missingId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining(missingId.toString());

            verify(branchRepository, never()).save(any());
        }
    }
}
