import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWalkingRoute} from '../backend/server/walking-route.js';

test('카카오 도보 경로 응답의 실제 좌표와 거리·시간을 추출한다',()=>{
  const result=parseWalkingRoute({route:{properties:{totalDistance:1250,totalTime:1030},legs:[{steps:[{path:{points:[[127.01,37.5],[127.02,37.51]]}},{path:{points:[[127.02,37.51],[127.03,37.52]]}}]}]}});
  assert.equal(result.distanceMeters,1250);
  assert.equal(result.durationSeconds,1030);
  assert.deepEqual(result.points,[[127.01,37.5],[127.02,37.51],[127.02,37.51],[127.03,37.52]]);
});

test('좌표가 없는 경로를 실제 경로로 표시하지 않는다',()=>{
  assert.throws(()=>parseWalkingRoute({route:{properties:{totalDistance:100,totalTime:90},legs:[]}}));
});
