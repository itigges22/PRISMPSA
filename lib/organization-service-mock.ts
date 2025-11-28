// Temporary mock organization service to test UI
import { OrganizationStructure } from './organization-service';

export const organizationService = {
  async getOrganizationStructure(): Promise<OrganizationStructure | null> {
    console.log('Using mock organization service...');
    
    // Return mock data for testing
    const mockData: OrganizationStructure = {
      departments: [
        {
          id: '1',
          name: 'IT Department',
          description: 'Information Technology',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          roles: []
        },
        {
          id: '2', 
          name: 'Marketing',
          description: 'Marketing and Communications',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          roles: []
        }
      ],
      hierarchy: [
        {
          id: '1',
          name: 'Superadmin',
          department_name: 'IT Department',
          department_id: '1',
          hierarchy_level: 1000,
          is_system_role: true,
          user_count: 1,
          permissions: [],
          children: [
            {
              id: '2',
              name: 'Developer',
              department_name: 'IT Department',
              department_id: '1',
              hierarchy_level: 100,
              is_system_role: false,
              user_count: 0,
              permissions: [],
              children: []
            }
          ]
        },
        {
          id: '3',
          name: 'Marketing Manager',
          department_name: 'Marketing',
          department_id: '2',
          hierarchy_level: 200,
          is_system_role: false,
          user_count: 0,
          permissions: [],
          children: []
        }
      ],
      total_departments: 2,
      total_roles: 3,
      total_users: 1
    };

    console.log('Mock organization structure returned', mockData);
    return mockData;
  }
};
