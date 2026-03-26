export type UiNode = {
    id: string;
    type: string;
    props?: Record<string, any>;
    children?: UiNode[];
};

export type UiDocV1 = {
    version: 1;
    root: UiNode;
};

export type UiDoc = UiDocV1;

export type UiSurfaceKey = {
    appKey: string;
    surfaceKey: string;
};

export type UiSurfaceInfo = UiSurfaceKey & {
    title: string;
    fallbackDoc?: UiDoc;
};
