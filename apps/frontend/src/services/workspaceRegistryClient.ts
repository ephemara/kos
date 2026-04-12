import {
    registryGetAdapterManifest,
    registryListIntegrationContracts,
    type RegistryAdapterManifest,
    type RegistryIntegrationContract,
} from '@/generated/tauriRegistry.gen';

let tauriAdapterManifestPromise: Promise<RegistryAdapterManifest | null> | null = null;

function sortIntegrationContracts(
    contracts: RegistryIntegrationContract[],
): RegistryIntegrationContract[] {
    return [...contracts].sort((left, right) => {
        const stabilityWeight = (value: string) => {
            switch (value) {
                case 'host-api':
                    return 0;
                case 'integration':
                    return 1;
                default:
                    return 2;
            }
        };

        const stabilityDelta =
            stabilityWeight(left.stability_tier) - stabilityWeight(right.stability_tier);
        if (stabilityDelta !== 0) {
            return stabilityDelta;
        }

        if (left.pressure_score !== right.pressure_score) {
            return right.pressure_score - left.pressure_score;
        }

        return left.package_name.localeCompare(right.package_name);
    });
}

export async function getTauriAdapterManifest(): Promise<RegistryAdapterManifest | null> {
    if (!tauriAdapterManifestPromise) {
        tauriAdapterManifestPromise = registryGetAdapterManifest('tauri').catch((error) => {
            console.warn('[workspaceRegistryClient] Failed to load Tauri adapter manifest:', error);
            return null;
        });
    }

    return tauriAdapterManifestPromise;
}

export async function listTauriIntegrationContracts(): Promise<RegistryIntegrationContract[]> {
    try {
        const contracts = await registryListIntegrationContracts({
            adapter_target: 'tauri',
            stability_tier: null,
            capability: null,
            package_name_contains: null,
        });
        return sortIntegrationContracts(contracts);
    } catch (error) {
        console.warn(
            '[workspaceRegistryClient] Failed to load Tauri integration contracts:',
            error,
        );
        return [];
    }
}
