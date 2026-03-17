import { registerFileAccessChecker } from "../access";
import { canAccessFormFile } from "./form-access";

registerFileAccessChecker(canAccessFormFile);
