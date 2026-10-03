import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHTML({ children }: PropsWithChildren) {
  return <html lang="en"><head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0E0D13" />
    <meta name="description" content="Your music comes with you. Listen, explore, and enjoy your Audius library in Crimson Music." />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <title>Crimson Music</title>
    <link rel="preconnect" href="https://api.audius.co" />
    <ScrollViewStyleReset />
  </head><body>{children}</body></html>;
}
