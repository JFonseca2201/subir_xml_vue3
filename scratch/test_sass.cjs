const sass = require('sass');
const res = sass.compileString(`
.thumbnail-card {
  background: rgba(255, 255, 255, 0.04);
  [data-theme="light"] &,
  .v-theme--light & {
    background: #ffffff;
  }
}
`);
console.log(res.css);
