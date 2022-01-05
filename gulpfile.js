/* globals require */
/* sudo npm install -g gulp gulp-concat gulp-minify gulp-clean-css */
const gulp = require('gulp');
const concat = require('gulp-concat');
const minify = require('gulp-minify');
const cleanCSS = require('gulp-clean-css');

gulp.task('autobuild', function () {
    gulp.watch('src/**', {'ignoreInitial': false}, gulp.series('build'));
});

gulp.task('build', function () {
    gulp.src(['src/odm.js'])
        .pipe(concat('dist/odm.js'))
        .pipe(minify({
            ext: {'src': '.tmp.js', 'min': '.min.js'},
            compress: {'hoist_vars': true}
        }))
        .pipe(gulp.dest('.'));

    return gulp.src(['src/odm.css'])
        .pipe(concat('dist/odm.min.css'))
        .pipe(cleanCSS())
        .pipe(gulp.dest('.'));
});
