import { describe, expect, it } from 'vitest';
import {
  applySourceImagesToHotEvents,
  pickSourceImageFromFollowEntry,
  readSourceImage
} from '../src/utils/sourceImage.js';

describe('pickSourceImageFromFollowEntry', () => {
  it('prefers entries.authorAvatar over feeds.image', () => {
    expect(
      pickSourceImageFromFollowEntry({
        entries: { authorAvatar: 'https://cdn.example/a.jpg' },
        feeds: { image: 'https://cdn.example/f.jpg' }
      })
    ).toBe('https://cdn.example/a.jpg');
  });

  it('falls back to feeds.image when authorAvatar is missing', () => {
    expect(
      pickSourceImageFromFollowEntry({
        entries: {},
        feeds: { image: 'https://pbs.twimg.com/profile_images/x.jpg' }
      })
    ).toBe('https://pbs.twimg.com/profile_images/x.jpg');
  });

  it('ignores non-http values', () => {
    expect(
      pickSourceImageFromFollowEntry({
        entries: { authorAvatar: 'javascript:alert(1)' },
        feeds: { image: '  ' }
      })
    ).toBeUndefined();
  });
});

describe('readSourceImage', () => {
  it('reads metadata.source_image', () => {
    expect(readSourceImage({ source_image: 'https://cdn.example/a.jpg' })).toBe(
      'https://cdn.example/a.jpg'
    );
  });

  it('returns undefined when absent', () => {
    expect(readSourceImage({})).toBeUndefined();
    expect(readSourceImage(null)).toBeUndefined();
  });
});

describe('applySourceImagesToHotEvents', () => {
  it('fills missing sourceImage from the map', () => {
    const events = [
      {
        members: [
          { itemId: 'a', sourceImage: undefined as string | undefined },
          { itemId: 'b', sourceImage: 'https://keep.example/b.jpg' }
        ]
      }
    ];
    const out = applySourceImagesToHotEvents(
      events,
      new Map([['a', 'https://cdn.example/a.jpg']])
    );
    expect(out[0].members[0].sourceImage).toBe('https://cdn.example/a.jpg');
    expect(out[0].members[1].sourceImage).toBe('https://keep.example/b.jpg');
  });
});
