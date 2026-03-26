import React from 'react';
import type { NativeViewportProps } from '@/features/viewport/NativeViewport';

export type SharedViewportRequest = Pick<
  NativeViewportProps,
  | 'meshHandle'
  | 'onStatusChange'
  | 'onViewportHandleChange'
  | 'useSculptHandle'
  | 'syncSource'
  | 'captureInput'
  | 'hostInputMode'
  | 'showDiagnostics'
  | 'onPointerNdcEvent'
  | 'onSelectionChange'
  | 'onStrokeStart'
  | 'onStrokeMove'
  | 'onStrokeEnd'
  | 'gizmo'
> & {
  ownerId: string;
};

type SharedViewportSessionContextValue = {
  request: SharedViewportRequest | null;
  setRequest: React.Dispatch<React.SetStateAction<SharedViewportRequest | null>>;
};

const SharedViewportSessionContext = React.createContext<SharedViewportSessionContextValue | null>(null);

export function SharedViewportSessionProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = React.useState<SharedViewportRequest | null>(null);

  const value = React.useMemo<SharedViewportSessionContextValue>(
    () => ({ request, setRequest }),
    [request],
  );

  return (
    <SharedViewportSessionContext.Provider value={value}>
      {children}
    </SharedViewportSessionContext.Provider>
  );
}

export function useSharedViewportSession() {
  const context = React.useContext(SharedViewportSessionContext);
  if (!context) {
    throw new Error('useSharedViewportSession must be used inside SharedViewportSessionProvider');
  }
  return context;
}

export function useRegisterSharedViewport(request: SharedViewportRequest | null) {
  const { setRequest } = useSharedViewportSession();

  React.useEffect(() => {
    if (!request) {
      return;
    }

    setRequest(request);

    return () => {
      setRequest((current) => (current?.ownerId === request.ownerId ? null : current));
    };
  }, [request, setRequest]);
}
