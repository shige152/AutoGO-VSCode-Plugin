export interface BuildCommandArgsOptions {
    target: string;
    packso?: boolean;
    codeObfuscation?: boolean;
    apkArchitectures?: Record<string, boolean>;
}

function resolveBuildTarget(
    target: string,
    apkArchitectures: Record<string, boolean> = {}
): string {
    if (target !== 'apk') {
        return target;
    }

    const selectedArchitectures = Object.entries(apkArchitectures)
        .filter(([, isSelected]) => isSelected)
        .map(([architecture]) => architecture);

    if (selectedArchitectures.length === 0) {
        return target;
    }

    return `apk[${selectedArchitectures.join(',')}]`;
}

export function buildAgBuildArgs(options: BuildCommandArgsOptions): string[] {
    const args = ['build', '-t', resolveBuildTarget(options.target, options.apkArchitectures)];

    if (options.packso) {
        args.push('-e');
    }

    if (options.codeObfuscation) {
        args.push('-g');
    }

    return args;
}
