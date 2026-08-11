const THEME = {
  colors: {
    boardDark: '#3D2314',        // Dark mahogany board surface
    boardLight: '#C19A6B',       // Professional matte wood color
    boardFrame: '#4A2511',       // Rich wood frame
    boardFrameInner: '#2A1509',  // Inner shadow frame
    triangleDark: '#4A2511',     // Dark brown triangles
    triangleLight: '#F3E2C8',    // Soft ivory triangles
    triangleHighlight: 'rgba(255,215,0,0.5)', 
    checkerWhite: '#FFFFFF',
    checkerWhiteBorder: '#E6E6E6',
    checkerWhiteGlow: 'rgba(245,230,211,0.6)',
    checkerBlack: '#1A1A2E',     // Deep navy-black checkers
    checkerBlackBorder: '#0F0F1A',
    checkerBlackGlow: 'rgba(26,26,46,0.6)',
    barColor: '#2A1509',         // Center bar
    bearOffBg: '#1E1008',        // Bear-off tray
    gold: '#D4AF37',             // Gold accents
    goldLight: '#F0D060',        // Light gold
    textPrimary: '#F5E6D3',      // Primary text
    textSecondary: '#A0896E',    // Secondary text
    textDark: '#2A1509',         // Dark text
    diceWhite: '#FFFDF5',        // Dice face
    diceDots: '#1A1A2E',         // Dice dots
    diceShadow: 'rgba(0,0,0,0.4)',
    buttonPrimary: '#8B4513',    // Saddle brown button
    buttonHover: '#A0522D',      // Sienna hover
    overlay: 'rgba(0,0,0,0.7)',  // Modal overlay
    success: '#2ECC71',          // Success green
    danger: '#E74C3C',           // Danger red
    menuBg: '#1a0e08',           // Menu background
    selectedGlow: '#FFD700',     // Selected checker glow
  },
  sizes: {
    checkerRadius: 16,           // Checker circle radius
    pointWidth: 38,              // Triangle/point width
    barWidth: 46,                // Center bar width
    bearOffWidth: 40,            // Bear-off tray width
    borderWidth: 8,              // Board frame border
    diceSize: 36,                // Dice face size
  },
  fonts: {
    heading: 'serif',
    body: 'System',
  },
  gradients: {
    boardFrame: ['#6b3d1c', '#3a1d0c', '#2a1509'],   // Wood frame sheen
    boardSurface: ['#cda878', '#bb8f60', '#a67c4e'],  // Playing surface wood
    barSurface: ['#3a2414', '#241209', '#160b04'],    // Center bar
    panel: ['#33210f', '#1c1108'],                    // Player panel
    panelActive: ['#4a3316', '#2a1a0c'],              // Active player panel
    diceTray: ['#3d2818', '#241308'],                 // Dice tray
    gold: ['#F0D060', '#D4AF37', '#9c7d24'],          // Gold accent
  },
};
export default THEME;
