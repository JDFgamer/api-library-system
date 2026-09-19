import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UserModel } from '../../models/User/index.js';
import { SchoolModel } from '../../models/School/index.js';
import { PosModel } from '../../models/Pos/index.js';
import { AuthenticationError, NotFoundError, SchoolDisabledError, PosDisabledError } from '../../utils/errors.js';
import { UserRole } from '../../models/User/index.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPinResult extends AuthTokens {
  user: {
    id: string;
    name: string;
    role: UserRole;
    schoolId: string;
    posId?: string;
  };
}

export interface LoginEmailResult extends AuthTokens {
  user: {
    id: string;
    name: string;
    role: UserRole;
    email: string;
    schoolId?: string;
    posId?: string;
  };
}

/**
 * Login por PIN — solo para sellers en POS.
 * Filtra por schoolId para evitar colisión de PINs entre negocios.
 */
export async function loginWithPin(pin: string, schoolId: string): Promise<LoginPinResult> {
  const users = await UserModel.find({
    active: true,
    school: schoolId,
    role: 'seller',
  }).select('+pinHash +school +pos');

  let matchedUser = null;
  for (const user of users) {
    const isMatch = await user.comparePin(pin);
    if (isMatch) {
      matchedUser = user;
      break;
    }
  }

  if (!matchedUser) {
    throw new AuthenticationError('PIN inválido');
  }

  // Validar estado de la escuela y POS DESPUÉS de validar credenciales (anti-enumeración)
  const school = await SchoolModel.findById(matchedUser.school).lean();
  if (!school || !school.active) {
    throw new SchoolDisabledError();
  }

  if (matchedUser.pos) {
    const pos = await PosModel.findById(matchedUser.pos).lean();
    if (!pos || !pos.active) {
      throw new PosDisabledError();
    }
  }

  matchedUser.lastLoginAt = new Date();
  await matchedUser.save();

  const schoolIdStr = matchedUser.school!.toString();
  const tokens = generateTokens(
    matchedUser._id.toString(),
    matchedUser.role,
    schoolIdStr,
    matchedUser.pos?.toString()
  );

  return {
    ...tokens,
    user: {
      id: matchedUser._id.toString(),
      name: matchedUser.name,
      role: matchedUser.role,
      schoolId: schoolIdStr,
      posId: matchedUser.pos?.toString(),
    },
  };
}

/**
 * Login por email — para admin y superadmin en el panel web.
 */
export async function loginWithEmail(email: string, password: string): Promise<LoginEmailResult> {
  const user = await UserModel.findOne({
    email: email.toLowerCase(),
    active: true,
  }).select('+passwordHash +school +pos');

  if (!user) {
    throw new AuthenticationError('Credenciales inválidas');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AuthenticationError('Credenciales inválidas');
  }

  // Validar estado de la escuela y POS DESPUÉS de validar credenciales (anti-enumeración)
  // Superadmin no tiene school asignada → saltar validación
  if (user.role !== 'superadmin' && user.school) {
    const school = await SchoolModel.findById(user.school).lean();
    if (!school || !school.active) {
      throw new SchoolDisabledError();
    }
  }

  if (user.pos) {
    const pos = await PosModel.findById(user.pos).lean();
    if (!pos || !pos.active) {
      throw new PosDisabledError();
    }
  }

  user.lastLoginAt = new Date();
  await user.save();

  const schoolId = user.school?.toString();
  const tokens = generateTokens(
    user._id.toString(),
    user.role,
    schoolId,
    user.pos?.toString()
  );

  return {
    ...tokens,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      email: user.email,
      schoolId,
      posId: user.pos?.toString(),
    },
  };
}

/**
 * Refresca el access token re-leyendo datos actuales desde DB.
 * No confía solo en los claims del refresh token.
 * También valida que la escuela y el POS sigan activos.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_SECRET) as {
      sub: string;
      role: UserRole;
      schoolId?: string;
      posId?: string;
    };

    const user = await UserModel.findById(payload.sub).select('+school +pos').lean();
    if (!user || !user.active) {
      throw new AuthenticationError('Usuario no encontrado o inactivo');
    }

    // Validar estado de la escuela y POS al refrescar
    if (payload.role !== 'superadmin' && user.school) {
      const school = await SchoolModel.findById(user.school).lean();
      if (!school || !school.active) {
        throw new SchoolDisabledError();
      }
    }

    if (user.pos) {
      const pos = await PosModel.findById(user.pos).lean();
      if (!pos || !pos.active) {
        throw new PosDisabledError();
      }
    }

    const schoolId = user.school?.toString();
    const accessToken = jwt.sign(
      { sub: user._id.toString(), role: user.role, schoolId, posId: user.pos?.toString() },
      env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return { accessToken };
  } catch (error) {
    // Re-lanzar errores semánticos conocidos (no convertirlos a AuthenticationError)
    if (error instanceof SchoolDisabledError || error instanceof PosDisabledError) {
      throw error;
    }
    // Solo errores de JWT/verificación se convierten a AuthenticationError
    throw new AuthenticationError('Token de actualización inválido');
  }
}

/**
 * Retorna datos del usuario autenticado.
 */
export async function getMe(userId: string): Promise<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  posId?: string;
}> {
  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: user.school?.toString(),
    posId: user.pos?.toString(),
  };
}

/**
 * Genera par de tokens JWT. schoolId es opcional (superadmin no tiene school).
 */
function generateTokens(
  userId: string,
  role: UserRole,
  schoolId?: string,
  posId?: string
): AuthTokens {
  const payload = { sub: userId, role, schoolId, posId };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
  const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as '7d',
  });
  return { accessToken, refreshToken };
}