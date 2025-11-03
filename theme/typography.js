// theme/typography.js

/**
 * A map of all the Poppins fonts used in the app.
 * This is used by `expo-font` in App.js to load the fonts.
 */
export const customFontsToLoad = {
  'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  'Poppins-ExtraBold': require('../assets/fonts/Poppins-ExtraBold.ttf'),
  'Poppins-Black': require('../assets/fonts/Poppins-Black.ttf'),
};

/**
 * A map of font weights to their corresponding Poppins font family.
 * This allows us to use `fontWeight` and have it automatically
 * select the correct font file.
 */
const fontMap = {
  '100': 'Poppins-Light', // Assuming you have these, add if needed
  '200': 'Poppins-Light',
  '300': 'Poppins-Light',
  '400': 'Poppins-Regular',
  normal: 'Poppins-Regular',
  '500': 'Poppins-Medium',
  '600': 'Poppins-SemiBold',
  '700': 'Poppins-Bold',
  bold: 'Poppins-Bold',
  '800': 'Poppins-ExtraBold',
  '900': 'Poppins-Black',
};

/**
 * Sets the default font for all Text components in the app.
 * It also overrides the `fontFamily` based on the `fontWeight` prop,
 * making font weights work automatically and consistently across platforms.
 */
export const setDefaultFont = () => {
  const oldTextRender = Text.render;
  Text.render = function (...args) {
    const origin = oldTextRender.call(this, ...args);
    const style = [
      { fontFamily: 'Poppins-Regular' }, // Default font
      origin.props.style,
      { fontFamily: fontMap[origin.props.style?.fontWeight] || 'Poppins-Regular' },
    ];
    return { ...origin, props: { ...origin.props, style } };
  };
};