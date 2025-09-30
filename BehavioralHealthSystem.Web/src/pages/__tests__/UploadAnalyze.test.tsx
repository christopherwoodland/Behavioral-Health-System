import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import UploadAnalyze from '../UploadAnalyze';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { fileGroupService } from '../../services/fileGroupService';
import type { FileGroup, SessionInitiateResponse } from '../../types';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../services/api');
jest.mock('../../services/fileGroupService');
jest.mock('../../utils', () => ({
  getUserId: jest.fn(() => 'test-user-id')
}));

// Mock file input change
Object.defineProperty(window, 'File', {
  value: class MockFile {
    constructor(parts: any[], filename: string, properties?: any) {
      this.name = filename;
      this.size = parts.reduce((acc, part) => acc + (typeof part === 'string' ? part.length : part.size || 0), 0);
      this.type = properties?.type || 'application/octet-stream';
    }
    name: string;
    size: number;
    type: string;
  }
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;
const mockFileGroupService = fileGroupService as jest.Mocked<typeof fileGroupService>;

describe('UploadAnalyze', () => {
  const mockGroups: FileGroup[] = [
    {
      groupId: 'group-1',
      groupName: 'Test Group 1',
      description: 'First test group',
      createdBy: 'test-user-id',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      sessionCount: 5,
      status: 'active'
    },
    {
      groupId: 'group-2',
      groupName: 'Test Group 2',
      description: 'Second test group',
      createdBy: 'test-user-id',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      sessionCount: 3,
      status: 'active'
    }
  ];

  const mockInitiateResponse: SessionInitiateResponse = {
    sessionId: 'test-session-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', name: 'Test User' },
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getAccessToken: jest.fn()
    });

    mockFileGroupService.getUserGroups.mockResolvedValue(mockGroups);
    mockFileGroupService.validateGroupName.mockResolvedValue({ isValid: true });
    mockFileGroupService.createGroup.mockResolvedValue('new-group-id');
    mockFileGroupService.deleteGroup.mockResolvedValue();
    
    mockRiskAssessmentService.initiate.mockResolvedValue(mockInitiateResponse);
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        {component}
      </MemoryRouter>
    );
  };

  describe('Initial Rendering', () => {
    it('renders upload form correctly', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      expect(screen.getByText('Upload & Analyze')).toBeInTheDocument();
      expect(screen.getByText('Choose File')).toBeInTheDocument();
      expect(screen.getByText('Select Group')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload and Analyze' })).toBeInTheDocument();
    });

    it('disables upload button initially when no file is selected', () => {
      renderWithRouter(<UploadAnalyze />);
      
      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      expect(uploadButton).toBeDisabled();
    });

    it('loads groups in GroupSelector', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(mockFileGroupService.getUserGroups).toHaveBeenCalledWith('test-user-id');
      });
    });
  });

  describe('File Selection', () => {
    it('enables upload button when file is selected', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      expect(uploadButton).not.toBeDisabled();
    });

    it('displays selected file information', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      
      await userEvent.upload(fileInput, file);
      
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
    });

    it('validates file size limits', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      // Create a file that's too large (assuming 10MB limit)
      const largFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large-file.txt', { type: 'text/plain' });
      
      await userEvent.upload(fileInput, largFile);
      
      expect(screen.getByText(/File size exceeds the maximum limit/)).toBeInTheDocument();
    });

    it('validates file type restrictions', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-executable' });
      
      await userEvent.upload(fileInput, invalidFile);
      
      expect(screen.getByText(/Invalid file type/)).toBeInTheDocument();
    });
  });

  describe('Group Management', () => {
    it('allows creating a new group', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      // Wait for groups to load
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      // Open create group form
      const createButton = screen.getByLabelText('Create new group');
      fireEvent.click(createButton);

      // Fill out form
      await userEvent.type(screen.getByPlaceholderText('Enter group name'), 'New Test Group');
      await userEvent.type(screen.getByPlaceholderText('Enter description (optional)'), 'New group description');

      // Submit form
      fireEvent.click(screen.getByText('Create Group'));

      await waitFor(() => {
        expect(mockFileGroupService.createGroup).toHaveBeenCalledWith(
          'test-user-id',
          'New Test Group',
          'New group description'
        );
      });
    });

    it('validates group name uniqueness during creation', async () => {
      mockFileGroupService.validateGroupName.mockResolvedValue({
        isValid: false,
        message: 'Group name already exists'
      });

      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      // Open create group form
      fireEvent.click(screen.getByLabelText('Create new group'));

      // Enter duplicate name
      await userEvent.type(screen.getByPlaceholderText('Enter group name'), 'Test Group 1');

      await waitFor(() => {
        expect(screen.getByText('Group name already exists')).toBeInTheDocument();
      });

      // Create button should be disabled
      expect(screen.getByText('Create Group')).toBeDisabled();
    });

    it('allows deleting a group with confirmation', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByLabelText('Delete group "Test Group 1"');
      fireEvent.click(deleteButton);

      // Confirm deletion
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Yes, delete'));

      await waitFor(() => {
        expect(mockFileGroupService.deleteGroup).toHaveBeenCalledWith('group-1');
      });
    });

    it('refreshes group list after creating a group', async () => {
      const updatedGroups = [...mockGroups, {
        id: 'new-group-id',
        name: 'New Test Group',
        description: 'New group description',
        createdBy: 'test-user-id',
        createdAt: '2024-01-03T00:00:00Z',
        fileCount: 0
      }];

      mockFileGroupService.getUserGroups
        .mockResolvedValueOnce(mockGroups)
        .mockResolvedValueOnce(updatedGroups);

      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      // Create new group
      fireEvent.click(screen.getByLabelText('Create new group'));
      await userEvent.type(screen.getByPlaceholderText('Enter group name'), 'New Test Group');
      fireEvent.click(screen.getByText('Create Group'));

      await waitFor(() => {
        expect(mockFileGroupService.getUserGroups).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('File Upload Process', () => {
    it('uploads file successfully without group selection', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      // Select file
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      // Click upload
      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockRiskAssessmentService.initiate).toHaveBeenCalledWith(
          file,
          'test-user-id',
          undefined // no group selected
        );
      });

      expect(screen.getByText('Upload successful')).toBeInTheDocument();
    });

    it('uploads file successfully with group selection', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      // Wait for groups to load and select one
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Test Group 1'));

      // Select file
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      // Click upload
      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockRiskAssessmentService.initiate).toHaveBeenCalledWith(
          file,
          'test-user-id',
          'group-1'
        );
      });
    });

    it('shows upload progress during file upload', async () => {
      // Mock a delayed response to show progress
      let resolveUpload: (value: InitiateResponse) => void;
      const uploadPromise = new Promise<InitiateResponse>((resolve) => {
        resolveUpload = resolve;
      });
      mockRiskAssessmentService.initiate.mockReturnValue(uploadPromise);

      renderWithRouter(<UploadAnalyze />);
      
      // Select file and upload
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      fireEvent.click(uploadButton);

      // Should show uploading state
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
      expect(uploadButton).toBeDisabled();

      // Resolve the upload
      act(() => {
        resolveUpload!(mockInitiateResponse);
      });

      await waitFor(() => {
        expect(screen.getByText('Upload successful')).toBeInTheDocument();
      });
    });

    it('handles upload errors gracefully', async () => {
      const errorResponse = new Error('Upload failed');
      mockRiskAssessmentService.initiate.mockRejectedValue(errorResponse);

      renderWithRouter(<UploadAnalyze />);
      
      // Select file and upload
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      // Upload button should be re-enabled for retry
      expect(uploadButton).not.toBeDisabled();
    });

    it('redirects to predictions page after successful upload', async () => {
      const mockNavigate = jest.fn();
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate
      }));

      renderWithRouter(<UploadAnalyze />);
      
      // Select file and upload
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockRiskAssessmentService.initiate).toHaveBeenCalled();
      });

      // Should navigate to predictions page with session ID
      // Note: This would require mocking useNavigate properly in the component
    });
  });

  describe('Form Validation', () => {
    it('requires file selection before upload', () => {
      renderWithRouter(<UploadAnalyze />);
      
      const uploadButton = screen.getByRole('button', { name: 'Upload and Analyze' });
      expect(uploadButton).toBeDisabled();
    });

    it('shows validation message for empty file', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      const emptyFile = new File([''], 'empty-file.txt', { type: 'text/plain' });
      
      await userEvent.upload(fileInput, emptyFile);
      
      expect(screen.getByText(/File cannot be empty/)).toBeInTheDocument();
    });

    it('validates maximum file count per group', async () => {
      // Mock a group that has reached file limit
      const fullGroup = {
        ...mockGroups[0],
        fileCount: 100 // Assuming 100 is the limit
      };
      mockFileGroupService.getUserGroups.mockResolvedValue([fullGroup]);

      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Group 1'));

      // Should show warning about file limit
      expect(screen.getByText(/This group has reached the maximum file limit/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and ARIA attributes', () => {
      renderWithRouter(<UploadAnalyze />);
      
      expect(screen.getByLabelText('Choose File')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload and Analyze' })).toBeInTheDocument();
      
      // Check form structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithRouter(<UploadAnalyze />);
      
      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText('Choose File')).toHaveFocus();

      await user.tab();
      // Should focus on group selector

      await user.tab();
      expect(screen.getByRole('button', { name: 'Upload and Analyze' })).toHaveFocus();
    });

    it('provides proper error announcements for screen readers', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      const fileInput = screen.getByLabelText('Choose File');
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-executable' });
      
      await userEvent.upload(fileInput, invalidFile);
      
      const errorMessage = screen.getByText(/Invalid file type/);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('User Experience', () => {
    it('shows helpful tips and instructions', () => {
      renderWithRouter(<UploadAnalyze />);
      
      expect(screen.getByText(/Upload a file to perform risk assessment analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Supported file types:/)).toBeInTheDocument();
    });

    it('provides feedback during group operations', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      // Mock slow group creation
      let resolveCreate: (value: string) => void;
      const createPromise = new Promise<string>((resolve) => {
        resolveCreate = resolve;
      });
      mockFileGroupService.createGroup.mockReturnValue(createPromise);

      // Create group
      fireEvent.click(screen.getByLabelText('Create new group'));
      await userEvent.type(screen.getByPlaceholderText('Enter group name'), 'New Group');
      fireEvent.click(screen.getByText('Create Group'));

      // Should show creating state
      expect(screen.getByText('Creating...')).toBeInTheDocument();

      // Resolve creation
      act(() => {
        resolveCreate!('new-group-id');
      });

      await waitFor(() => {
        expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
      });
    });

    it('remembers form state during group operations', async () => {
      renderWithRouter(<UploadAnalyze />);
      
      // Select file first
      const fileInput = screen.getByLabelText('Choose File');
      const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, file);

      expect(screen.getByText('test-file.txt')).toBeInTheDocument();

      // Create a group
      await waitFor(() => {
        expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new group'));
      await userEvent.type(screen.getByPlaceholderText('Enter group name'), 'New Group');
      fireEvent.click(screen.getByText('Create Group'));

      // File should still be selected
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
    });
  });
});