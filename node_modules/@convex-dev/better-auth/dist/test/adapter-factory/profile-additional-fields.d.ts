export declare const ADDITIONAL_FIELDS_NORMAL_TESTS: readonly ["deleteMany - should delete many models with numeric values", "findMany - should find many models with sortBy", "findMany - should find many models with sortBy and limit", "findMany - should find many with join and sortBy", "findOne - should find a model with additional fields"];
export declare const ADDITIONAL_FIELDS_AUTH_FLOW_TEST: "should sign up with additional fields";
export declare const coreNormalTestSuite: (options?: {
    disableTests?: Partial<Record<"init - tests", boolean> & {
        ALL?: boolean;
    }> | undefined;
} | undefined) => (helpers: {
    adapter: () => Promise<import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>>;
    log: import("@better-auth/test-utils/adapter").Logger;
    adapterDisplayName: string;
    getBetterAuthOptions: () => import("better-auth").BetterAuthOptions;
    modifyBetterAuthOptions: (options: import("better-auth").BetterAuthOptions) => Promise<import("better-auth").BetterAuthOptions>;
    cleanup: () => Promise<void>;
    runMigrations: () => Promise<void>;
    prefixTests?: string | undefined;
    onTestFinish: (stats: import("@better-auth/test-utils/adapter").TestSuiteStats) => Promise<void>;
    customIdGenerator?: () => any | Promise<any> | undefined;
    transformIdOutput?: (id: any) => string | undefined;
}) => Promise<void>;
export declare const additionalFieldsNormalTestSuite: (options?: {
    disableTests?: Partial<Record<string | number, boolean> & {
        ALL?: boolean;
    }> | undefined;
} | undefined) => (helpers: {
    adapter: () => Promise<import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>>;
    log: import("@better-auth/test-utils/adapter").Logger;
    adapterDisplayName: string;
    getBetterAuthOptions: () => import("better-auth").BetterAuthOptions;
    modifyBetterAuthOptions: (options: import("better-auth").BetterAuthOptions) => Promise<import("better-auth").BetterAuthOptions>;
    cleanup: () => Promise<void>;
    runMigrations: () => Promise<void>;
    prefixTests?: string | undefined;
    onTestFinish: (stats: import("@better-auth/test-utils/adapter").TestSuiteStats) => Promise<void>;
    customIdGenerator?: () => any | Promise<any> | undefined;
    transformIdOutput?: (id: any) => string | undefined;
}) => Promise<void>;
export declare const coreAuthFlowTestSuite: (options?: {
    disableTests?: Partial<Record<"should successfully sign up" | "should successfully sign in" | "should successfully get session" | "should not sign in with invalid email" | "should store and retrieve timestamps correctly across timezones", boolean> & {
        ALL?: boolean;
    }> | undefined;
} | undefined) => (helpers: {
    adapter: () => Promise<import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>>;
    log: import("@better-auth/test-utils/adapter").Logger;
    adapterDisplayName: string;
    getBetterAuthOptions: () => import("better-auth").BetterAuthOptions;
    modifyBetterAuthOptions: (options: import("better-auth").BetterAuthOptions) => Promise<import("better-auth").BetterAuthOptions>;
    cleanup: () => Promise<void>;
    runMigrations: () => Promise<void>;
    prefixTests?: string | undefined;
    onTestFinish: (stats: import("@better-auth/test-utils/adapter").TestSuiteStats) => Promise<void>;
    customIdGenerator?: () => any | Promise<any> | undefined;
    transformIdOutput?: (id: any) => string | undefined;
}) => Promise<void>;
export declare const additionalFieldsAuthFlowTestSuite: (options?: {
    disableTests?: Partial<Record<"should sign up with additional fields", boolean> & {
        ALL?: boolean;
    }> | undefined;
} | undefined) => (helpers: {
    adapter: () => Promise<import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>>;
    log: import("@better-auth/test-utils/adapter").Logger;
    adapterDisplayName: string;
    getBetterAuthOptions: () => import("better-auth").BetterAuthOptions;
    modifyBetterAuthOptions: (options: import("better-auth").BetterAuthOptions) => Promise<import("better-auth").BetterAuthOptions>;
    cleanup: () => Promise<void>;
    runMigrations: () => Promise<void>;
    prefixTests?: string | undefined;
    onTestFinish: (stats: import("@better-auth/test-utils/adapter").TestSuiteStats) => Promise<void>;
    customIdGenerator?: () => any | Promise<any> | undefined;
    transformIdOutput?: (id: any) => string | undefined;
}) => Promise<void>;
//# sourceMappingURL=profile-additional-fields.d.ts.map