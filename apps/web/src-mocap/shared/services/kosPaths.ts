/**
 * kosPaths.ts - K_OS Asset Path Resolver
 * 
 * Provides access to bundled resources and user data directories.
 * User data is stored in Documents/K_OS/ for easy access.
 */

import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * K_OS directory types
 */
export type KosDirectoryType =
    | 'projects'
    | 'brushes'
    | 'matcaps'
    | 'alphas'
    | 'materials'
    | 'meshes';

/**
 * Get the K_OS user data root directory
 * @returns Documents/K_OS path
 */
export async function getKosUserRoot(): Promise<string> {
    return invoke<string>('get_app_user_root');
}

/**
 * Get a specific K_OS user directory
 * @param dirType - Type of directory (projects, brushes, matcaps, etc.)
 * @returns Full path to the directory
 */
export async function getKosUserDir(dirType: KosDirectoryType): Promise<string> {
    return invoke<string>('get_app_user_dir', { dirType });
}

/**
 * List files in a K_OS directory (combines bundled + user)
 * @param dirType - Type of directory
 * @param extension - Optional file extension filter (without dot)
 * @returns Array of file paths
 */
export async function listKosDirectory(
    dirType: KosDirectoryType,
    extension?: string
): Promise<string[]> {
    return invoke<string[]>('list_app_directory', { dirType, extension });
}

export async function readFileBase64(path: string): Promise<string> {
    if (!isTauri()) return '';
    return invoke<string>('read_file_base64', { path });
}

/**
 * Get path for saving a new project
 */
export async function getProjectSavePath(name: string): Promise<string> {
    const projectsDir = await getKosUserDir('projects');
    return `${projectsDir}/${name}.kproj`;
}

/**
 * List all projects (bundled templates + user projects)
 */
export async function listProjects(): Promise<{
    templates: string[];
    userProjects: string[];
}> {
    const all = await listKosDirectory('projects', 'kproj');

    // Separate bundled (resources/) from user (Documents/K_OS/)
    const templates: string[] = [];
    const userProjects: string[] = [];

    for (const path of all) {
        if (path.includes('resources')) {
            templates.push(path);
        } else {
            userProjects.push(path);
        }
    }

    return { templates, userProjects };
}


