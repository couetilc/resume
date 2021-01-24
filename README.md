Notes while working on this:
- <section> is basically useless, was meant to modify heading hierarchy was never
  implemented in browsers. Just use the regular h1, h2, .. instead, and for any
  standalone content, use <article>
    - https://www.smashingmagazine.com/2020/01/html5-article-section/
- trying to create "components", which are identified by a class name and
  styled according to DOM structure rather than by subordinate class names
  (I don't want to keep naming things)

TODO
- try reading the resume on a screen reader, can I improve accessibility using
  ARIA and semantic html?
- When doing website version, make the resume width 806px to simulate paper width.
