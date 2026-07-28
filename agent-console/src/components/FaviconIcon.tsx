import { Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Globe } from 'lucide-react';
import { memo, useState, type CSSProperties } from 'react';

import { getHostFromUrl } from '../utils/url';

/** Async site favicon — Globe first, then duckduckgo ip3 icon when loaded. */
export const FaviconIcon = memo(function FaviconIcon({
  url,
  host: hostProp,
  size = 16,
  style,
}: {
  url?: string;
  host?: string;
  size?: number;
  style?: CSSProperties;
}) {
  const host = hostProp || (url ? getHostFromUrl(url) : '');
  const [loaded, setLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const letter = host ? host.charAt(0).toUpperCase() : '?';

  const shellStyle: CSSProperties = {
    width: size,
    height: size,
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    position: 'relative',
    ...style,
  };

  if (!host) {
    return (
      <span style={shellStyle}>
        <Icon color={cssVar.colorTextDescription} icon={Globe} size={size} />
      </span>
    );
  }

  if (imgFailed) {
    return (
      <span style={shellStyle}>
        <span style={{ fontSize: Math.max(9, size - 6), fontWeight: 600, lineHeight: 1 }}>{letter}</span>
      </span>
    );
  }

  return (
    <span style={shellStyle}>
      {!loaded ? <Icon color={cssVar.colorTextDescription} icon={Globe} size={size} /> : null}
      <img
        alt=""
        height={size}
        loading="lazy"
        src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
        style={{
          borderRadius: 4,
          objectFit: 'contain',
          opacity: loaded ? 1 : 0,
          position: loaded ? 'relative' : 'absolute',
          inset: 0,
        }}
        width={size}
        onError={() => setImgFailed(true)}
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
});
