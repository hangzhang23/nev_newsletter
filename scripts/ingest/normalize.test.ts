import { describe, expect, it } from 'vitest';
import {
  classifyPowertrain,
  classifyPriceBand,
  normalizeBrand,
  parsePrice,
  parseWheelbase,
} from './normalize';

describe('normalizeBrand 品牌归并', () => {
  it('鸿蒙四界统一归并', () => {
    expect(normalizeBrand('鸿蒙智行·问界')).toBe('鸿蒙智行');
    expect(normalizeBrand('问界')).toBe('鸿蒙智行');
    expect(normalizeBrand('智界')).toBe('鸿蒙智行');
    expect(normalizeBrand('享界')).toBe('鸿蒙智行');
    expect(normalizeBrand('尊界')).toBe('鸿蒙智行');
    expect(normalizeBrand('尚界(鸿蒙智行)')).toBe('鸿蒙智行');
    expect(normalizeBrand('华为/奇瑞')).toBe('鸿蒙智行');
  });

  it('别名归一', () => {
    expect(normalizeBrand('零跑汽车')).toBe('零跑');
    expect(normalizeBrand('小鹏汽车')).toBe('小鹏');
    expect(normalizeBrand('理想汽车')).toBe('理想');
    expect(normalizeBrand('上汽通用五菱')).toBe('五菱');
    expect(normalizeBrand('广汽埃安')).toBe('埃安');
    expect(normalizeBrand('长城魏牌')).toBe('魏牌');
    expect(normalizeBrand('AUDI')).toBe('奥迪');
    expect(normalizeBrand('上汽AUDI')).toBe('奥迪');
    expect(normalizeBrand('华晨宝马')).toBe('宝马');
    expect(normalizeBrand('梅赛德斯-奔驰')).toBe('奔驰');
    expect(normalizeBrand('firefly萤火虫')).toBe('萤火虫');
  });

  it('脏数据剔除', () => {
    expect(normalizeBrand('双联屏+全液晶仪表')).toBeNull();
    expect(normalizeBrand('')).toBeNull();
    expect(normalizeBrand('   ')).toBeNull();
  });

  it('括号/逗号备注清理', () => {
    expect(normalizeBrand('乐道（蔚来旗下），2026-04-28开启预售')).toBe('乐道');
    expect(normalizeBrand('smart（梅赛德斯-奔驰/吉利合资），2026-04-24预售')).toBe('smart');
  });

  it('吉利分流', () => {
    expect(normalizeBrand('吉利汽车')).toBe('吉利');
    expect(normalizeBrand('吉利银河')).toBe('吉利银河');
  });
});

describe('parsePrice 价格数值化', () => {
  it('区间价格', () => {
    expect(parsePrice('6.39-9.09')).toEqual({ min: 6.39, max: 9.09 });
    expect(parsePrice('9.99-14.19')).toEqual({ min: 9.99, max: 14.19 });
  });
  it('起售价', () => {
    expect(parsePrice('25.98起(预)')).toEqual({ min: 25.98, max: null });
    expect(parsePrice('约23起(参)')).toEqual({ min: 23, max: null });
  });
  it('单一价', () => {
    expect(parsePrice('30.99(预)')).toEqual({ min: 30.99, max: 30.99 });
  });
  it('待公布', () => {
    expect(parsePrice('待公布')).toEqual({ min: null, max: null });
    expect(parsePrice('待查')).toEqual({ min: null, max: null });
  });
});

describe('parseWheelbase 轴距提取', () => {
  it('数值', () => {
    expect(parseWheelbase('2605')).toBe(2605);
    expect(parseWheelbase('3050')).toBe(3050);
  });
  it('无效', () => {
    expect(parseWheelbase('待查')).toBeNull();
    expect(parseWheelbase('')).toBeNull();
  });
});

describe('classifyPowertrain 动力归并', () => {
  it('大类', () => {
    expect(classifyPowertrain('纯电')).toBe('纯电');
    expect(classifyPowertrain('纯电BEV')).toBe('纯电');
    expect(classifyPowertrain('插混PHEV')).toBe('插混');
    expect(classifyPowertrain('插电混动')).toBe('插混');
    expect(classifyPowertrain('增程式')).toBe('增程');
    expect(classifyPowertrain('燃油')).toBe('燃油');
  });
  it('复合/变体', () => {
    expect(classifyPowertrain('EV+DM-i')).toBe('插混');
    expect(classifyPowertrain('超级增程混动')).toBe('增程');
    expect(classifyPowertrain('纯电+增程')).toBe('增程');
    expect(classifyPowertrain('纯电（EV）+插混（DM-5）')).toBe('插混');
  });
  it('脏数据', () => {
    expect(classifyPowertrain('3010')).toBe('未知');
    expect(classifyPowertrain('—')).toBe('未知');
    expect(classifyPowertrain('')).toBe('未知');
  });
});

describe('classifyPriceBand 价格带', () => {
  it('分段', () => {
    expect(classifyPriceBand(null)).toBe('待公布');
    expect(classifyPriceBand(9.99)).toBe('10万内');
    expect(classifyPriceBand(10)).toBe('10-15万');
    expect(classifyPriceBand(15)).toBe('15-20万');
    expect(classifyPriceBand(20)).toBe('20-30万');
    expect(classifyPriceBand(30)).toBe('30万以上');
  });
});
