import { solid, type Material, type RGB } from '../model/material';

export const textured=(color:RGB):Material=>({color,texture:'fur'});
export const fur=textured([139,117,95]);
export const skin=solid([177,127,119]);
