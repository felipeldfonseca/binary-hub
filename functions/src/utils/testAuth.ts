import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

export interface TestUser {
  uid: string;
  email: string;
  emailVerified?: boolean;
  customClaims?: Record<string, any>;
}

export class FirebaseAuthTestUtils {
  private static instance: FirebaseAuthTestUtils;
  private auth: ReturnType<typeof getAuth>;

  private constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!getApps().length) {
      initializeApp();
    }
    this.auth = getAuth();
  }

  public static getInstance(): FirebaseAuthTestUtils {
    if (!FirebaseAuthTestUtils.instance) {
      FirebaseAuthTestUtils.instance = new FirebaseAuthTestUtils();
    }
    return FirebaseAuthTestUtils.instance;
  }

  /**
   * Creates a test user in the Firebase Auth emulator
   */
  public async createTestUser(userData: TestUser): Promise<string> {
    try {
      // In test environment, mock the user creation
      const mockUserRecord = {
        uid: userData.uid,
        email: userData.email,
        emailVerified: userData.emailVerified || false,
        disabled: false,
        metadata: {
          creationTime: new Date().toUTCString(),
          lastSignInTime: new Date().toUTCString(),
        },
        providerData: [],
        customClaims: userData.customClaims || {},
      };

      // Mock the Firebase Admin SDK calls
      (this.auth.createUser as jest.MockedFunction<any>).mockResolvedValue(mockUserRecord);
      
      const userRecord = await this.auth.createUser({
        uid: userData.uid,
        email: userData.email,
        emailVerified: userData.emailVerified || false,
      });

      if (userData.customClaims) {
        (this.auth.setCustomUserClaims as jest.MockedFunction<any>).mockResolvedValue(void 0);
        await this.auth.setCustomUserClaims(userRecord.uid, userData.customClaims);
      }

      return userRecord.uid;
    } catch (error) {
      console.error('Error creating test user:', error);
      throw error;
    }
  }

  /**
   * Generates a custom token for testing purposes
   */
  public async createCustomToken(
    uid: string, 
    additionalClaims?: Record<string, any>
  ): Promise<string> {
    try {
      // Mock the token creation in tests
      (this.auth.createCustomToken as jest.MockedFunction<any>).mockResolvedValue(`mock-token-${uid}`);
      return await this.auth.createCustomToken(uid, additionalClaims);
    } catch (error) {
      console.error('Error creating custom token:', error);
      throw error;
    }
  }

  /**
   * Verifies if a token is valid (useful for testing)
   */
  public async verifyIdToken(token: string) {
    try {
      return await this.auth.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      throw error;
    }
  }

  /**
   * Deletes a test user from the Auth emulator
   */
  public async deleteTestUser(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
    } catch (error) {
      console.error('Error deleting test user:', error);
      throw error;
    }
  }

  /**
   * Creates a test user and returns both the user and a custom token
   */
  public async createTestUserWithToken(userData: TestUser): Promise<{
    uid: string;
    token: string;
  }> {
    const uid = await this.createTestUser(userData);
    const token = await this.createCustomToken(uid, userData.customClaims);
    
    return { uid, token };
  }

  /**
   * Clean up all test users (useful for test teardown)
   */
  public async cleanupTestUsers(uids: string[]): Promise<void> {
    const promises = uids.map(uid => this.deleteTestUser(uid).catch(() => {}));
    await Promise.all(promises);
  }
}

// Export convenience functions
export const createTestUser = (userData: TestUser) => 
  FirebaseAuthTestUtils.getInstance().createTestUser(userData);

export const createCustomToken = (uid: string, additionalClaims?: Record<string, any>) => 
  FirebaseAuthTestUtils.getInstance().createCustomToken(uid, additionalClaims);

export const createTestUserWithToken = (userData: TestUser) => 
  FirebaseAuthTestUtils.getInstance().createTestUserWithToken(userData);

export const cleanupTestUsers = (uids: string[]) => 
  FirebaseAuthTestUtils.getInstance().cleanupTestUsers(uids);

// Pre-defined test users for common use cases
export const TEST_USERS = {
  BASIC_USER: {
    uid: 'test-user-basic',
    email: 'test@example.com',
    emailVerified: true,
  },
  ADMIN_USER: {
    uid: 'test-user-admin',
    email: 'admin@example.com',
    emailVerified: true,
    customClaims: { admin: true },
  },
  PREMIUM_USER: {
    uid: 'test-user-premium',
    email: 'premium@example.com',
    emailVerified: true,
    customClaims: { plan: 'premium' },
  },
} as const;