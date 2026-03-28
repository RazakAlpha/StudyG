export declare const PLUGIN_TABLE_NORMAL_TESTS: readonly ["create - should apply default values to fields", "create - should return null for nullable foreign keys", "create - should support arrays", "create - should support json", "findMany - should find many with both one-to-one and one-to-many joins", "findMany - should find many with one-to-one join", "findMany - should handle mixed joins correctly when some are missing", "findMany - should return empty array when base records don't exist with joins", "findMany - should return null for one-to-one join when joined records don't exist", "findMany - should select fields with one-to-one join", "findOne - should not apply defaultValue if value not found", "findOne - should return an object for one-to-one joins", "findOne - should return null for one-to-one join when joined record doesn't exist", "findOne - should select fields with one-to-one join", "findOne - should work with both one-to-one and one-to-many joins"];
export declare const pluginTableNormalTestSuite: (options?: {
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
//# sourceMappingURL=profile-plugin-table.d.ts.map