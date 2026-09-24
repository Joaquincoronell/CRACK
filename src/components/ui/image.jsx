import * as React from 'react'

const Image = React.forwardRef(({ src, alt = '', loading = 'lazy', decoding = 'async', ...props }, ref) => (
  <img ref={ref} src={src} alt={alt} loading={loading} decoding={decoding} {...props} />
))
Image.displayName = 'Image'

export { Image }
