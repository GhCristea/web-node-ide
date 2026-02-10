import { useState, useRef, useCallback, useEffect } from 'react';
import {
  WebContainer,
  type FileSystemTree,
  type DirectoryNode
} from '@webcontainer/api';

function isDir(file: FileSystemTree[string]): file is DirectoryNode {
  return 'directory' in file;
}

function buildWebContainerTree(
  filesMap: Record<string, string>
): FileSystemTree {
  const tree: FileSystemTree = {};
  Object.entries(filesMap).forEach(([filePath, content]) => {
    const pathParts = filePath.split('/');
    let subtree = tree;

    for (let index = 0; index < pathParts.length; index++) {
      const pathPart = pathParts[index];
      if (!pathPart) continue;

      let node = subtree[pathPart];

      if (!node) {
        if (index !== pathParts.length - 1) {
          subtree[pathPart] = { directory: {} };
        } else {
          subtree[pathPart] = { file: { contents: content } };
        }
        node = subtree[pathPart];
      }

      if (node && isDir(node)) {
        subtree = node.directory;
      }
    }
  });
  return tree;
}

export function useWebContainer() {
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const bootPromiseRef = useRef<Promise<void> | null>(null);

  const boot = useCallback(async () => {
    if (isReady || bootPromiseRef.current) return;

    try {
      bootPromiseRef.current = WebContainer.boot().then((instance) => {
        setWebContainer(instance);
      });
      await bootPromiseRef.current;
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      bootPromiseRef.current = null;
    }
  }, [isReady]);

  const mount = useCallback(
    async (filesMap: Record<string, string>) => {
      if (!webContainer) return;
      const tree = buildWebContainerTree(filesMap);
      await webContainer.mount(tree);
    },
    [webContainer]
  );

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!webContainer) return;
      await webContainer.fs.writeFile(path, content);
    },
    [webContainer]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    boot();
  }, [boot]);

  return {
    webContainer,
    isReady,
    error,
    boot,
    mount,
    writeFile
  };
}
