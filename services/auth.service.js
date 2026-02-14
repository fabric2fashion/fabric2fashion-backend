/**
 * Auth Service
 * Handles registration, login, and auth rules
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/user.model");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";

/**
 * Register new user
 * Default status: pending (admin approval later)
 */
async function registerUser({
  role,
  name,
  email,
  mobile,
  password
}) {
  // Check existing user
  const existing =
    email ? await UserModel.findByEmail(email) : null;

  if (existing) {
    throw new Error("User already exists");
  }

  const password_hash = password
    ? await bcrypt.hash(password, SALT_ROUNDS)
    : null;

  const user = await UserModel.createUser({
    role,
    name,
    email,
    mobile,
    password_hash
  });

  return {
    id: user.id,
    role: user.role,
    status: user.status
  };
}

/**
 * Login user
 */
async function loginUser({ email, password }) {
  const user = await UserModel.findByEmail(email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (user.status !== "active") {
    throw new Error(
      `Account is ${user.status}. Please contact support.`
    );
  }

  const isValid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    user: {
      id: user.id,
      role: user.role,
      name: user.name
    }
  };
}

module.exports = {
  registerUser,
  loginUser
};
