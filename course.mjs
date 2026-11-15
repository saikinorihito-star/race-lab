// Shared lightweight left-handed half-oval, used by 2D and 3D renderers.
// The course is schematic; race distances in meters are normalized to this track.
export const HALF_STRAIGHT=48;
export const TURN_RADIUS=28;
export const LANE_WIDTH=1.55;
export const INSIDE_MARGIN=2.0;
export const TRACK_OUTER_OFFSET=13.8;
export const HALF_LAP_LENGTH=HALF_STRAIGHT*2+Math.PI*TURN_RADIUS;

// Counterclockwise as seen from above: east on the lower straight, curve left
// around the eastern end, and west on the upper straight.
export function coursePoint(s,offset=0) {
 const first=HALF_STRAIGHT;
 const curveEnd=HALF_STRAIGHT+Math.PI*TURN_RADIUS;
 if(s<first) {
  return {x:-HALF_STRAIGHT+s,z:-TURN_RADIUS-offset,dx:1,dz:0,yaw:0};
 }
 if(s<curveEnd) {
  const theta=-Math.PI/2+(s-first)/TURN_RADIUS;
  const radius=TURN_RADIUS+offset;
  const dx=-Math.sin(theta),dz=Math.cos(theta);
  return {x:HALF_STRAIGHT+Math.cos(theta)*radius,z:Math.sin(theta)*radius,
   dx,dz,yaw:-Math.atan2(dz,dx)};
 }
 const x=HALF_STRAIGHT-(s-curveEnd);
 return {x,z:TURN_RADIUS+offset,dx:-1,dz:0,yaw:-Math.PI};
}
export function horseCoursePoint(raceMetres,raceDistance,lane) {
 const d=Math.max(1,Number(raceDistance)||2200);
 const s=Number(raceMetres)*HALF_LAP_LENGTH/d;
 return coursePoint(s,INSIDE_MARGIN+Math.max(0,Math.min(6,Number(lane)||0))*LANE_WIDTH);
}
export function lengthAtMetres(metres,raceDistance) {
 return Number(metres)*HALF_LAP_LENGTH/Math.max(1,Number(raceDistance)||2200);
}
