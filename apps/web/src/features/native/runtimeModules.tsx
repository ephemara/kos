import React from 'react';
import { NativeToolWorkspace } from '@/features/native/NativeToolWorkspace';
import type { NativeToolModuleId } from '@/config/nativeToolModules';

type NativeModuleComponentProps = Record<string, unknown>;

function createNativeModuleComponent(moduleId: NativeToolModuleId) {
    function NativeModuleComponent(props: NativeModuleComponentProps) {
        return <NativeToolWorkspace moduleId={moduleId} sharedState={(props as any).sharedState} />;
    }

    NativeModuleComponent.displayName = `Native${moduleId[0].toUpperCase()}${moduleId.slice(1)}Module`;
    return NativeModuleComponent;
}

export const KSculptNative = createNativeModuleComponent('sculpt');
export const KRetopoNative = createNativeModuleComponent('retopo');
export const KGreebleNative = createNativeModuleComponent('greeble');
export const KScatterNative = createNativeModuleComponent('scatter');
export const KAtlasNative = createNativeModuleComponent('atlas');
export const KBakeNative = createNativeModuleComponent('bake');
export const KGraphosNative = createNativeModuleComponent('graphos');
export const KAutopbrNative = createNativeModuleComponent('autopbr');
export const KPainterNative = createNativeModuleComponent('painter');
export const KWeightNative = createNativeModuleComponent('weight');
export const KClonerNative = createNativeModuleComponent('cloner');
export const KInspectNative = createNativeModuleComponent('inspect');
export const KTectonNative = createNativeModuleComponent('tecton');
export const KQuantumNative = createNativeModuleComponent('quantum');
